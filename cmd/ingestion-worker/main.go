package main

import (
	"context"
	"errors"
	"fmt"
	"github.com/Ale1x/meddata-italia/internal/ingestion"
	"github.com/Ale1x/meddata-italia/internal/messaging"
	"github.com/Ale1x/meddata-italia/internal/objectstorage"
	"github.com/Ale1x/meddata-italia/internal/platform"
	"github.com/Ale1x/meddata-italia/internal/sources"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	cfg, err := platform.LoadConfig()
	if err != nil {
		fatal(err)
	}
	logger := platform.NewLogger("ingestion-worker", cfg.Environment, cfg.Version)
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	shutdownTrace, err := platform.SetupTelemetry(ctx, "ingestion-worker")
	if err != nil {
		fatal(err)
	}
	defer shutdownTrace(context.Background())
	db, err := platform.OpenDatabase(ctx, cfg.DatabaseURL)
	if err != nil {
		fatal(err)
	}
	defer db.Close()
	store, err := objectstorage.New(cfg.MinioEndpoint, cfg.MinioAccessKey, cfg.MinioSecretKey, cfg.MinioBucket, cfg.MinioUseSSL)
	if err != nil {
		fatal(err)
	}
	if err := store.EnsureBucket(ctx); err != nil {
		fatal(err)
	}
	sourceConfigs, err := sources.LoadDir(cfg.SourcesDir)
	if err != nil {
		fatal(err)
	}
	metrics := platform.NewMetrics(prometheus.DefaultRegisterer)
	metricsServer := &http.Server{Addr: cfg.MetricsAddress, Handler: promhttp.Handler(), ReadHeaderTimeout: 5 * time.Second}
	go func() {
		if err := metricsServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("metrics server failed", slog.Any("error", err))
			stop()
		}
	}()
	defer metricsServer.Shutdown(context.Background())
	processor := &ingestion.Processor{DB: db, Store: store, Sources: sourceConfigs, Logger: logger, Metrics: metrics, HTTPClient: &http.Client{Timeout: cfg.DownloadTimeout, Transport: otelhttp.NewTransport(http.DefaultTransport)}}
	if err := processor.SyncSources(ctx); err != nil {
		fatal(err)
	}
	broker, err := messaging.NewBroker(cfg.RabbitMQURL, cfg.RabbitMQPrefetch, logger)
	if err != nil {
		fatal(err)
	}
	defer broker.Close()
	outbox := &messaging.OutboxPublisher{DB: db, Broker: broker, Logger: logger}
	go outbox.Run(ctx)
	deliveries, err := broker.Deliveries(ctx)
	if err != nil {
		fatal(err)
	}
	logger.Info("ingestion worker ready")
	for {
		select {
		case <-ctx.Done():
			return
		case d, ok := <-deliveries:
			if !ok {
				return
			}
			event, err := messaging.Decode(d.Body)
			if err != nil {
				logger.Error("invalid event", slog.Any("error", err))
				_ = broker.DeadLetter(ctx, d, err.Error())
				_ = d.Ack(false)
				continue
			}
			metrics.RabbitReceived.WithLabelValues(event.EventType).Inc()
			if event.EventType != "ingestion.requested" {
				_ = d.Ack(false)
				continue
			}
			if err := processor.Process(ctx, event); err != nil {
				logger.Error("ingestion failed", slog.String("event_id", event.EventID.String()), slog.Any("error", err))
				retryCount := int32(0)
				if v, ok := d.Headers["x-retry-count"].(int32); ok {
					retryCount = v
				}
				if retryCount >= 3 {
					_ = broker.DeadLetter(ctx, d, err.Error())
				} else {
					_ = broker.Retry(ctx, d, err.Error())
				}
				_ = d.Ack(false)
				continue
			}
			_ = d.Ack(false)
		}
	}
}
func fatal(err error) { fmt.Fprintln(os.Stderr, err); os.Exit(1) }

var _ = time.Second
