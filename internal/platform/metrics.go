package platform

import "github.com/prometheus/client_golang/prometheus"

type Metrics struct {
	DiscoveryRuns       *prometheus.CounterVec
	ArtifactsDiscovered *prometheus.CounterVec
	SchemaChanges       *prometheus.CounterVec
	DownloadDuration    *prometheus.HistogramVec
	ArtifactSize        *prometheus.GaugeVec
	IngestionRuns       *prometheus.CounterVec
	IngestionRecords    *prometheus.CounterVec
	RejectedRecords     *prometheus.CounterVec
	Warnings            *prometheus.CounterVec
	IngestionDuration   *prometheus.HistogramVec
	CanonicalChanged    *prometheus.CounterVec
	OfficialGroups      prometheus.Gauge
	OfficialMemberships prometheus.Gauge
	RabbitReceived      *prometheus.CounterVec
	RabbitPublished     *prometheus.CounterVec
	OutboxPending       prometheus.Gauge
	HTTPRequests        *prometheus.CounterVec
	HTTPDuration        *prometheus.HistogramVec
}

func NewMetrics(reg prometheus.Registerer) *Metrics {
	m := &Metrics{
		DiscoveryRuns:       prometheus.NewCounterVec(prometheus.CounterOpts{Name: "source_discovery_runs_total", Help: "Source discovery runs."}, []string{"source_id", "result"}),
		ArtifactsDiscovered: prometheus.NewCounterVec(prometheus.CounterOpts{Name: "source_artifacts_discovered_total", Help: "Artifacts discovered."}, []string{"source_id"}),
		SchemaChanges:       prometheus.NewCounterVec(prometheus.CounterOpts{Name: "source_schema_changes_total", Help: "Schema changes."}, []string{"source_id"}),
		DownloadDuration:    prometheus.NewHistogramVec(prometheus.HistogramOpts{Name: "source_download_duration_seconds", Help: "Artifact download duration."}, []string{"source_id"}),
		ArtifactSize:        prometheus.NewGaugeVec(prometheus.GaugeOpts{Name: "source_artifact_size_bytes", Help: "Artifact size."}, []string{"source_id"}),
		IngestionRuns:       prometheus.NewCounterVec(prometheus.CounterOpts{Name: "ingestion_runs_total", Help: "Ingestion runs."}, []string{"source_id", "status"}),
		IngestionRecords:    prometheus.NewCounterVec(prometheus.CounterOpts{Name: "ingestion_records_total", Help: "Ingestion records."}, []string{"source_id"}),
		RejectedRecords:     prometheus.NewCounterVec(prometheus.CounterOpts{Name: "ingestion_rejected_records_total", Help: "Rejected records."}, []string{"source_id"}),
		Warnings:            prometheus.NewCounterVec(prometheus.CounterOpts{Name: "ingestion_warnings_total", Help: "Normalization warnings."}, []string{"source_id", "severity"}),
		IngestionDuration:   prometheus.NewHistogramVec(prometheus.HistogramOpts{Name: "ingestion_duration_seconds", Help: "Ingestion duration."}, []string{"source_id", "status"}),
		CanonicalChanged:    prometheus.NewCounterVec(prometheus.CounterOpts{Name: "canonical_entities_changed_total", Help: "Canonical changes."}, []string{"entity"}),
		OfficialGroups:      prometheus.NewGauge(prometheus.GaugeOpts{Name: "official_equivalence_groups_total", Help: "Current official groups."}),
		OfficialMemberships: prometheus.NewGauge(prometheus.GaugeOpts{Name: "official_equivalence_memberships_total", Help: "Current official memberships."}),
		RabbitReceived:      prometheus.NewCounterVec(prometheus.CounterOpts{Name: "rabbitmq_messages_received_total", Help: "RabbitMQ messages received."}, []string{"event_type"}),
		RabbitPublished:     prometheus.NewCounterVec(prometheus.CounterOpts{Name: "rabbitmq_messages_published_total", Help: "RabbitMQ messages published."}, []string{"event_type"}),
		OutboxPending:       prometheus.NewGauge(prometheus.GaugeOpts{Name: "outbox_pending_events", Help: "Pending outbox events."}),
		HTTPRequests:        prometheus.NewCounterVec(prometheus.CounterOpts{Name: "http_requests_total", Help: "HTTP requests."}, []string{"method", "route", "status"}),
		HTTPDuration:        prometheus.NewHistogramVec(prometheus.HistogramOpts{Name: "http_request_duration_seconds", Help: "HTTP request duration."}, []string{"method", "route"}),
	}
	reg.MustRegister(m.DiscoveryRuns, m.ArtifactsDiscovered, m.SchemaChanges, m.DownloadDuration, m.ArtifactSize, m.IngestionRuns, m.IngestionRecords, m.RejectedRecords, m.Warnings, m.IngestionDuration, m.CanonicalChanged, m.OfficialGroups, m.OfficialMemberships, m.RabbitReceived, m.RabbitPublished, m.OutboxPending, m.HTTPRequests, m.HTTPDuration)
	return m
}
