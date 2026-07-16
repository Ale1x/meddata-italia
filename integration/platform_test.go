//go:build integration

package integration_test

import (
	"context"
	"database/sql"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	dbgen "github.com/Ale1x/meddata-italia/db/generated"
	"github.com/Ale1x/meddata-italia/internal/catalog"
	"github.com/Ale1x/meddata-italia/internal/ingestion"
	"github.com/Ale1x/meddata-italia/internal/messaging"
	"github.com/Ale1x/meddata-italia/internal/objectstorage"
	"github.com/Ale1x/meddata-italia/internal/platform"
	"github.com/Ale1x/meddata-italia/internal/sources"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/pressly/goose/v3"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/rabbitmq/amqp091-go"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"
)

func TestInfrastructureAndVerticalSlice(t *testing.T) {
	if os.Getenv("RUN_INTEGRATION") != "1" {
		t.Skip("set RUN_INTEGRATION=1 to start Docker containers")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 4*time.Minute)
	defer cancel()
	pg, err := postgres.Run(ctx, "postgres:17-alpine", postgres.WithDatabase("medicine"), postgres.WithUsername("medicine"), postgres.WithPassword("medicine"), postgres.BasicWaitStrategies())
	if err != nil {
		t.Fatal(err)
	}
	testcontainers.CleanupContainer(t, pg)
	rabbit, err := testcontainers.Run(ctx, "rabbitmq:4-management-alpine", testcontainers.WithExposedPorts("5672/tcp"), testcontainers.WithEnv(map[string]string{"RABBITMQ_DEFAULT_USER": "medicine", "RABBITMQ_DEFAULT_PASS": "medicine"}), testcontainers.WithWaitStrategy(wait.ForListeningPort("5672/tcp")))
	if err != nil {
		t.Fatal(err)
	}
	testcontainers.CleanupContainer(t, rabbit)
	minioC, err := testcontainers.Run(ctx, "minio/minio:latest", testcontainers.WithCmd("server", "/data"), testcontainers.WithExposedPorts("9000/tcp"), testcontainers.WithEnv(map[string]string{"MINIO_ROOT_USER": "minioadmin", "MINIO_ROOT_PASSWORD": "minioadmin"}), testcontainers.WithWaitStrategy(wait.ForHTTP("/minio/health/live").WithPort("9000/tcp")))
	if err != nil {
		t.Fatal(err)
	}
	testcontainers.CleanupContainer(t, minioC)
	pgURL, err := pg.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		t.Fatal(err)
	}
	database, err := sql.Open("pgx", pgURL)
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	if err := goose.Up(database, "../db/migrations"); err != nil {
		t.Fatal(err)
	}
	var table string
	if err := database.QueryRow(`SELECT to_regclass('public.outbox_events')::text`).Scan(&table); err != nil || table != "outbox_events" {
		t.Fatalf("migration: table=%q err=%v", table, err)
	}
	rabbitHost, _ := rabbit.Host(ctx)
	rabbitPort, _ := rabbit.MappedPort(ctx, "5672/tcp")
	rabbitURL := fmt.Sprintf("amqp://medicine:medicine@%s:%s/", rabbitHost, rabbitPort.Port())
	conn, err := amqp091.Dial(rabbitURL)
	if err != nil {
		t.Fatal(err)
	}
	_ = conn.Close()
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	broker, err := messaging.NewBroker(rabbitURL, 10, logger)
	if err != nil {
		t.Fatal(err)
	}
	defer broker.Close()
	deliveries, err := broker.Deliveries(ctx)
	if err != nil {
		t.Fatal(err)
	}
	probe, err := messaging.NewEnvelope("ingestion.requested", "integration-test", uuid.New(), nil, ingestion.Request{SourceID: "probe"})
	if err != nil {
		t.Fatal(err)
	}
	if err := broker.Publish(ctx, probe); err != nil {
		t.Fatal(err)
	}
	select {
	case delivery := <-deliveries:
		decoded, err := messaging.Decode(delivery.Body)
		if err != nil || decoded.EventID != probe.EventID {
			t.Fatalf("rabbit round trip: event=%v err=%v", decoded.EventID, err)
		}
		_ = delivery.Ack(false)
	case <-time.After(5 * time.Second):
		t.Fatal("timed out waiting for RabbitMQ delivery")
	}
	minioHost, _ := minioC.Host(ctx)
	minioPort, _ := minioC.MappedPort(ctx, "9000/tcp")
	client, err := minio.New(fmt.Sprintf("%s:%s", minioHost, minioPort.Port()), &minio.Options{Creds: credentials.NewStaticV4("minioadmin", "minioadmin", ""), Secure: false})
	if err != nil {
		t.Fatal(err)
	}
	if err := client.MakeBucket(ctx, "medicine-data", minio.MakeBucketOptions{}); err != nil {
		t.Fatal(err)
	}

	fixtures := map[string][]byte{}
	for _, name := range []string{"packages.csv", "package-ingredients.csv", "atc.csv", "transparency.csv"} {
		fixtures[name], err = os.ReadFile(filepath.Join("..", "testdata", "aifa", name))
		if err != nil {
			t.Fatal(err)
		}
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/artifact/") {
			name := strings.TrimPrefix(r.URL.Path, "/artifact/")
			body, ok := fixtures[name]
			if !ok {
				http.NotFound(w, r)
				return
			}
			w.Header().Set("Content-Type", "text/csv")
			_, _ = w.Write(body)
			return
		}
		_, _ = io.WriteString(w, `<html><a href="/artifact/packages.csv">CSV 15/07/2026</a></html>`)
	}))
	defer server.Close()
	configs := map[string]sources.Config{"aifa-packages": fixtureSource("aifa-packages", "aifa-packages", server.URL+"/artifact/packages.csv", server.URL), "aifa-atc": fixtureSource("aifa-atc", "aifa-atc", server.URL+"/artifact/atc.csv", server.URL), "aifa-package-ingredients": fixtureSource("aifa-package-ingredients", "aifa-package-ingredients", server.URL+"/artifact/package-ingredients.csv", server.URL), "aifa-transparency-list": fixtureSource("aifa-transparency-list", "aifa-transparency", server.URL+"/artifact/transparency.csv", server.URL)}
	pool, err := pgxpool.New(ctx, pgURL)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	store, err := objectstorage.New(fmt.Sprintf("%s:%s", minioHost, minioPort.Port()), "minioadmin", "minioadmin", "medicine-data", false)
	if err != nil {
		t.Fatal(err)
	}
	processor := &ingestion.Processor{DB: pool, Store: store, Sources: configs, Logger: logger, HTTPClient: server.Client()}
	if err := processor.SyncSources(ctx); err != nil {
		t.Fatal(err)
	}
	correlation := uuid.New()
	for _, sourceID := range []string{"aifa-packages", "aifa-atc", "aifa-package-ingredients", "aifa-transparency-list"} {
		event, err := messaging.NewEnvelope("ingestion.requested", "integration-test", correlation, nil, ingestion.Request{SourceID: sourceID})
		if err != nil {
			t.Fatal(err)
		}
		if err := processor.Process(ctx, event); err != nil {
			t.Fatalf("process %s: %v", sourceID, err)
		}
	}
	queries := dbgen.New(pool)
	pkg, err := queries.GetPackageByAIC(ctx, "044155024")
	if err != nil {
		t.Fatal(err)
	}
	members, err := queries.ListOfficialEquivalents(ctx, pkg.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(members) != 2 {
		t.Fatalf("official equivalents=%d, want 2", len(members))
	}
	unchanged, err := messaging.NewEnvelope("ingestion.requested", "integration-test", correlation, nil, ingestion.Request{SourceID: "aifa-transparency-list"})
	if err != nil {
		t.Fatal(err)
	}
	if err := processor.Process(ctx, unchanged); err != nil {
		t.Fatal(err)
	}
	var status string
	if err := pool.QueryRow(ctx, `SELECT status FROM ingestion_runs WHERE event_id=$1`, unchanged.EventID).Scan(&status); err != nil {
		t.Fatal(err)
	}
	if status != "UNCHANGED" {
		t.Fatalf("second ingestion status=%s", status)
	}
	outboxCtx, outboxCancel := context.WithCancel(ctx)
	outbox := &messaging.OutboxPublisher{DB: pool, Broker: broker, Logger: logger, Interval: 10 * time.Millisecond, BatchSize: 10}
	go outbox.Run(outboxCtx)
	defer outboxCancel()
	deadline := time.Now().Add(5 * time.Second)
	for {
		var pending int
		if err := pool.QueryRow(ctx, `SELECT count(*) FROM outbox_events WHERE published_at IS NULL`).Scan(&pending); err != nil {
			t.Fatal(err)
		}
		if pending == 0 {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("outbox still has %d pending events", pending)
		}
		time.Sleep(20 * time.Millisecond)
	}
	api := &catalog.API{Queries: queries, Logger: slog.New(slog.NewTextHandler(io.Discard, nil)), Metrics: platform.NewMetrics(prometheus.NewRegistry())}
	rec := httptest.NewRecorder()
	api.Router().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/packages/by-aic/44155024?include=provenance", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("lookup status=%d body=%s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), `"aic":"044155024"`) {
		t.Fatalf("lookup response missing canonical AIC: %s", rec.Body.String())
	}
	equivalents := httptest.NewRecorder()
	api.Router().ServeHTTP(equivalents, httptest.NewRequest(http.MethodGet, "/api/v1/packages/"+uuid.UUID(pkg.ID.Bytes).String()+"/official-equivalents", nil))
	if equivalents.Code != http.StatusOK || !strings.Contains(equivalents.Body.String(), `"group_source_identifier":"H1A"`) {
		t.Fatalf("equivalents status=%d body=%s", equivalents.Code, equivalents.Body.String())
	}
	comparison := httptest.NewRecorder()
	api.Router().ServeHTTP(comparison, httptest.NewRequest(http.MethodGet, "/api/v1/official-equivalence/compare?left_aic=44155024&right_aic=39716182", nil))
	if comparison.Code != http.StatusOK || !strings.Contains(comparison.Body.String(), `"equivalent":true`) || !strings.Contains(comparison.Body.String(), `"reason":"SAME_OFFICIAL_GROUP"`) {
		t.Fatalf("comparison status=%d body=%s", comparison.Code, comparison.Body.String())
	}
}

func fixtureSource(id, parser, artifact, index string) sources.Config {
	return sources.Config{ID: id, Name: id, Authority: "AIFA", Enabled: true, IndexURL: index, StaticURLOverride: artifact, Discovery: sources.DiscoveryConfig{Type: "html-link", PreferredFormats: []string{"csv"}}, Download: sources.DownloadConfig{MaxSizeBytes: 10 << 20}, Parser: sources.ParserConfig{Type: parser, Encoding: "utf-8"}}
}
