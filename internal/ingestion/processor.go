package ingestion

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"github.com/example/medicine-platform/internal/discovery"
	"github.com/example/medicine-platform/internal/messaging"
	"github.com/example/medicine-platform/internal/objectstorage"
	"github.com/example/medicine-platform/internal/platform"
	"github.com/example/medicine-platform/internal/sources"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.opentelemetry.io/otel"
	"log/slog"
	"net/http"
	"path"
	"strings"
	"time"
)

const TransformVersion = "v1.0.0"

type Request struct {
	SourceID      string `json:"source_id"`
	Force         bool   `json:"force"`
	DiscoveryOnly bool   `json:"discovery_only"`
}
type Processor struct {
	DB         *pgxpool.Pool
	Store      *objectstorage.Store
	Sources    map[string]sources.Config
	Logger     *slog.Logger
	Metrics    *platform.Metrics
	HTTPClient *http.Client
}

func (p *Processor) SyncSources(ctx context.Context) error {
	for _, cfg := range p.Sources {
		b, _ := json.Marshal(cfg)
		_, err := p.DB.Exec(ctx, `INSERT INTO sources(id,name,authority,index_url,enabled,declared_frequency,config) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,authority=EXCLUDED.authority,index_url=EXCLUDED.index_url,enabled=EXCLUDED.enabled,declared_frequency=EXCLUDED.declared_frequency,config=EXCLUDED.config,updated_at=now()`, cfg.ID, cfg.Name, cfg.Authority, cfg.IndexURL, cfg.Enabled, cfg.DeclaredFrequency, b)
		if err != nil {
			return err
		}
	}
	return nil
}
func (p *Processor) Process(ctx context.Context, event messaging.Envelope) error {
	started := time.Now()
	metricStatus := "FAILED"
	ctx, span := otel.Tracer("medicine/ingestion").Start(ctx, "ingestion process")
	defer span.End()
	var req Request
	if err := json.Unmarshal(event.Payload, &req); err != nil {
		return err
	}
	cfg, ok := p.Sources[req.SourceID]
	if !ok {
		return fmt.Errorf("unknown source %q", req.SourceID)
	}
	if p.Metrics != nil {
		defer func() {
			p.Metrics.IngestionRuns.WithLabelValues(cfg.ID, metricStatus).Inc()
			p.Metrics.IngestionDuration.WithLabelValues(cfg.ID, metricStatus).Observe(time.Since(started).Seconds())
		}()
	}
	conn, err := p.DB.Acquire(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()
	var locked bool
	if err := conn.QueryRow(ctx, `SELECT pg_try_advisory_lock(hashtext($1))`, req.SourceID).Scan(&locked); err != nil {
		return err
	}
	if !locked {
		return fmt.Errorf("source %s is already being ingested", req.SourceID)
	}
	defer conn.Exec(context.Background(), `SELECT pg_advisory_unlock(hashtext($1))`, req.SourceID)
	runID := uuid.New()
	tag, err := conn.Exec(ctx, `INSERT INTO ingestion_runs(id,source_id,event_id,correlation_id,status,force,discovery_only,transform_version) VALUES($1,$2,$3,$4,'DISCOVERING',$5,$6,$7) ON CONFLICT(event_id) DO NOTHING`, runID, req.SourceID, event.EventID, event.CorrelationID, req.Force, req.DiscoveryOnly, TransformVersion)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return nil
	}
	failed := true
	defer func() {
		if failed {
			_, _ = conn.Exec(context.Background(), `UPDATE ingestion_runs SET status='FAILED',finished_at=now(),error='processing failed' WHERE id=$1 AND status NOT IN ('SUCCEEDED','FAILED','UNCHANGED')`, runID)
		}
	}()
	d := discovery.Discoverer{Client: p.HTTPClient}
	disc, err := d.Discover(ctx, cfg)
	if err != nil {
		if p.Metrics != nil {
			p.Metrics.DiscoveryRuns.WithLabelValues(cfg.ID, "failed").Inc()
		}
		return p.fail(ctx, runID, "DISCOVERY_FAILED", err)
	}
	if p.Metrics != nil {
		p.Metrics.DiscoveryRuns.WithLabelValues(cfg.ID, "succeeded").Inc()
	}
	discoveryKey := fmt.Sprintf("discovery/%s/%s/index.html", cfg.ID, disc.ObservedAt.Format("20060102T150405Z"))
	if err := p.Store.Put(ctx, discoveryKey, "text/html", disc.HTML); err != nil {
		return p.fail(ctx, runID, "OBJECT_STORAGE_FAILED", err)
	}
	headers, _ := json.Marshal(disc.HTTPHeaders)
	discoveryID := uuid.New()
	_, err = conn.Exec(ctx, `INSERT INTO source_discoveries(id,source_id,status,index_url,page_sha256,html_object_key,http_status,http_headers,selected_url,selected_link_text,selected_format,declared_size_bytes,published_at) VALUES($1,$2,'SUCCEEDED',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, discoveryID, cfg.ID, disc.IndexURL, disc.PageSHA256, discoveryKey, disc.HTTPStatus, headers, disc.Artifact.URL, disc.Artifact.LinkText, disc.Artifact.Format, disc.Artifact.DeclaredSizeBytes, disc.Artifact.PublishedAt)
	if err != nil {
		return p.fail(ctx, runID, "DATABASE_FAILED", err)
	}
	if req.DiscoveryOnly {
		_, err = conn.Exec(ctx, `UPDATE ingestion_runs SET status='SUCCEEDED',finished_at=now() WHERE id=$1`, runID)
		failed = err != nil
		metricStatus = "SUCCEEDED"
		return err
	}
	_, _ = conn.Exec(ctx, `UPDATE ingestion_runs SET status='DOWNLOADING' WHERE id=$1`, runID)
	downloadStarted := time.Now()
	download, err := DownloadArtifact(ctx, p.HTTPClient, disc.Artifact.URL, cfg.Download.MaxSizeBytes)
	if err != nil {
		return p.fail(ctx, runID, "DOWNLOAD_FAILED", err)
	}
	if p.Metrics != nil {
		p.Metrics.DownloadDuration.WithLabelValues(cfg.ID).Observe(time.Since(downloadStarted).Seconds())
		p.Metrics.ArtifactSize.WithLabelValues(cfg.ID).Set(float64(download.Size))
	}
	ext := disc.Artifact.Format
	if ext == "" {
		ext = strings.TrimPrefix(path.Ext(disc.Artifact.URL), ".")
	}
	rawKey := fmt.Sprintf("raw/%s/%s/%s.%s", cfg.ID, download.DownloadedAt.Format("2006/01"), download.SHA256, ext)
	if err := p.Store.Put(ctx, rawKey, download.MediaType, download.Bytes); err != nil {
		return p.fail(ctx, runID, "OBJECT_STORAGE_FAILED", err)
	}
	artifactID := uuid.New()
	var insertedID uuid.UUID
	downloadHeaders, _ := json.Marshal(download.Headers)
	err = conn.QueryRow(ctx, `INSERT INTO source_artifacts(id,source_id,discovery_id,sha256,original_url,object_key,media_type,extension,size_bytes,http_headers,published_at,downloaded_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(source_id,sha256) DO NOTHING RETURNING id`, artifactID, cfg.ID, discoveryID, download.SHA256, disc.Artifact.URL, rawKey, download.MediaType, ext, download.Size, downloadHeaders, disc.Artifact.PublishedAt, download.DownloadedAt).Scan(&insertedID)
	if err != nil && err != pgx.ErrNoRows {
		return p.fail(ctx, runID, "DATABASE_FAILED", err)
	}
	if err == pgx.ErrNoRows {
		err = conn.QueryRow(ctx, `SELECT id FROM source_artifacts WHERE source_id=$1 AND sha256=$2`, cfg.ID, download.SHA256).Scan(&artifactID)
		if err != nil {
			return err
		}
		if !req.Force {
			var published bool
			err = conn.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM source_snapshots WHERE artifact_id=$1 AND parser_version=$2)`, artifactID, TransformVersion).Scan(&published)
			if err != nil {
				return p.fail(ctx, runID, "DATABASE_FAILED", err)
			}
			if published {
				_, err = conn.Exec(ctx, `UPDATE ingestion_runs SET artifact_id=$2,status='UNCHANGED',finished_at=now() WHERE id=$1`, runID, artifactID)
				failed = err != nil
				metricStatus = "UNCHANGED"
				return err
			}
		}
	} else {
		artifactID = insertedID
		if p.Metrics != nil {
			p.Metrics.ArtifactsDiscovered.WithLabelValues(cfg.ID).Inc()
		}
	}
	_, _ = conn.Exec(ctx, `UPDATE ingestion_runs SET artifact_id=$2,status='PARSING' WHERE id=$1`, runID, artifactID)
	parsed, err := ParseArtifact(download.Bytes, cfg)
	if err != nil {
		return p.fail(ctx, runID, "PARSING_FAILED", err)
	}
	if p.Metrics != nil {
		p.Metrics.IngestionRecords.WithLabelValues(cfg.ID).Add(float64(len(parsed.Records)))
		p.Metrics.RejectedRecords.WithLabelValues(cfg.ID).Add(float64(parsed.Rejected))
	}
	var previousSchema string
	schemaChanged := conn.QueryRow(ctx, `SELECT ss.schema_hash FROM source_snapshots ss JOIN source_artifacts sa ON sa.id=ss.artifact_id WHERE sa.source_id=$1 ORDER BY ss.observed_at DESC LIMIT 1`, cfg.ID).Scan(&previousSchema) == nil && previousSchema != parsed.SchemaHash
	profile := map[string]any{"source_id": cfg.ID, "sha256": download.SHA256, "row_count": len(parsed.Records), "column_count": len(parsed.Headers), "headers": parsed.Headers, "normalized_headers": parsed.NormalizedHeaders, "schema_hash": parsed.SchemaHash, "rejected": parsed.Rejected}
	profileBytes, _ := json.MarshalIndent(profile, "", "  ")
	_ = p.Store.Put(ctx, fmt.Sprintf("profiles/%s/%s/profile.json", cfg.ID, download.SHA256), "application/json", profileBytes)
	schemaBytes, _ := json.MarshalIndent(map[string]any{"columns": parsed.NormalizedHeaders, "schema_hash": parsed.SchemaHash}, "", "  ")
	_ = p.Store.Put(ctx, fmt.Sprintf("schemas/%s/%s/inferred-schema.json", cfg.ID, download.SHA256), "application/json", schemaBytes)
	sample := sampleJSONL(parsed.Records, 25)
	_ = p.Store.Put(ctx, fmt.Sprintf("samples/%s/%s/sample.jsonl", cfg.ID, download.SHA256), "application/x-ndjson", sample)
	if parsed.Rejected > 0 {
		_ = p.Store.Put(ctx, fmt.Sprintf("rejected/%s/%s/rejected.jsonl", cfg.ID, download.SHA256), "application/x-ndjson", rejectedJSONL(parsed.Rejections))
	}
	tx, err := conn.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	snapshotID := uuid.New()
	publishedDate := disc.Artifact.PublishedAt
	var pub any
	if publishedDate != nil {
		pub = publishedDate.UTC()
	} else {
		pub = nil
	}
	parserVersion := TransformVersion
	if req.Force {
		parserVersion += "+" + runID.String()
	}
	_, err = tx.Exec(ctx, `INSERT INTO source_snapshots(id,artifact_id,ingestion_run_id,parser_version,schema_hash,row_count,rejected_count,published_date) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, snapshotID, artifactID, runID, parserVersion, parsed.SchemaHash, len(parsed.Records), parsed.Rejected, pub)
	if err != nil {
		return err
	}
	if schemaChanged {
		_, err = tx.Exec(ctx, `INSERT INTO normalization_warnings(ingestion_run_id,severity,code,message,context) VALUES($1,'HIGH','SCHEMA_DRIFT','Normalized source schema changed',jsonb_build_object('previous_schema_hash',$2,'current_schema_hash',$3))`, runID, previousSchema, parsed.SchemaHash)
		if err != nil {
			return err
		}
		if p.Metrics != nil {
			p.Metrics.SchemaChanges.WithLabelValues(cfg.ID).Inc()
		}
	}
	recordRows := make([][]any, 0, len(parsed.Records))
	stageRows := make([][]any, 0, len(parsed.Records))
	observed := time.Now().UTC()
	for _, r := range parsed.Records {
		recordID := uuid.New()
		raw, _ := json.Marshal(r.Raw)
		payload, _ := json.Marshal(r.Payload)
		recordRows = append(recordRows, []any{recordID, snapshotID, artifactID, r.Ordinal, r.Key, r.Hash, raw, observed, TransformVersion})
		stageRows = append(stageRows, []any{uuid.New(), snapshotID, recordID, cfg.ID, r.Key, payload, "READY"})
	}
	_, err = tx.CopyFrom(ctx, pgx.Identifier{"source_records"}, []string{"id", "snapshot_id", "artifact_id", "ordinal", "source_record_key", "record_hash", "raw", "observed_at", "transform_version"}, pgx.CopyFromRows(recordRows))
	if err != nil {
		return fmt.Errorf("copy source records: %w", err)
	}
	_, err = tx.CopyFrom(ctx, pgx.Identifier{"staging_records"}, []string{"id", "snapshot_id", "source_record_id", "source_id", "record_key", "payload", "state"}, pgx.CopyFromRows(stageRows))
	if err != nil {
		return fmt.Errorf("copy staging records: %w", err)
	}
	if err := publishCanonical(ctx, tx, cfg.ID, snapshotID, artifactID, runID, event, observed); err != nil {
		return fmt.Errorf("publish canonical: %w", err)
	}
	_, err = tx.Exec(ctx, `UPDATE ingestion_runs SET status='SUCCEEDED',finished_at=now(),records_seen=$2,records_staged=$2,records_rejected=$3,warnings=(SELECT count(*) FROM normalization_warnings WHERE ingestion_run_id=$1) WHERE id=$1`, runID, len(parsed.Records), parsed.Rejected)
	if err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return err
	}
	failed = false
	metricStatus = "SUCCEEDED"
	p.Logger.Info("ingestion completed", slog.String("source_id", cfg.ID), slog.String("artifact_hash", download.SHA256), slog.String("ingestion_run_id", runID.String()), slog.Int("records", len(parsed.Records)))
	return nil
}
func (p *Processor) fail(ctx context.Context, run uuid.UUID, code string, cause error) error {
	_, _ = p.DB.Exec(ctx, `UPDATE ingestion_runs SET status='FAILED',finished_at=now(),error_code=$2,error=$3 WHERE id=$1`, run, code, cause.Error())
	return cause
}
func sampleJSONL(records []ParsedRecord, n int) []byte {
	if len(records) < n {
		n = len(records)
	}
	var b strings.Builder
	enc := json.NewEncoder(&b)
	for _, r := range records[:n] {
		_ = enc.Encode(r.Payload)
	}
	return []byte(b.String())
}
func rejectedJSONL(records []map[string]any) []byte {
	var b strings.Builder
	enc := json.NewEncoder(&b)
	for _, record := range records {
		_ = enc.Encode(record)
	}
	return []byte(b.String())
}
func artifactDigest(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}
