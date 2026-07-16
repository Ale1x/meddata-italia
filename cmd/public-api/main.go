package main

import (
	"context"
	"errors"
	"fmt"
	db "github.com/Ale1x/meddata-italia/db/generated"
	"github.com/Ale1x/meddata-italia/internal/catalog"
	"github.com/Ale1x/meddata-italia/internal/platform"
	"github.com/prometheus/client_golang/prometheus"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"
)

func main() {
	cfg, err := platform.LoadConfig()
	if err != nil {
		fatal(err)
	}
	logger := platform.NewLogger("public-api", cfg.Environment, cfg.Version)
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	shutdownTrace, err := platform.SetupTelemetry(ctx, "public-api")
	if err != nil {
		fatal(err)
	}
	defer shutdownTrace(context.Background())
	pool, err := platform.OpenDatabase(ctx, cfg.DatabaseURL)
	if err != nil {
		fatal(err)
	}
	defer pool.Close()
	api := &catalog.API{
		Queries:        db.New(pool),
		Logger:         logger,
		Metrics:        platform.NewMetrics(prometheus.DefaultRegisterer),
		AllowedOrigins: splitCSV(cfg.CORSAllowedOrigins),
	}
	server := &http.Server{Addr: cfg.HTTPAddress, Handler: api.Router(), ReadHeaderTimeout: 5 * time.Second}
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
		defer cancel()
		_ = server.Shutdown(shutdownCtx)
	}()
	logger.Info("public API listening", "address", cfg.HTTPAddress)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		fatal(err)
	}
}
func fatal(err error) { fmt.Fprintln(os.Stderr, err); os.Exit(1) }

func splitCSV(value string) []string {
	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		if part = strings.TrimSpace(part); part != "" {
			result = append(result, part)
		}
	}
	return result
}
