package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/Ale1x/meddata-italia/internal/messaging"
	"github.com/Ale1x/meddata-italia/internal/platform"
	"github.com/Ale1x/meddata-italia/internal/sources"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type request struct {
	SourceID      string `json:"source_id"`
	Force         bool   `json:"force"`
	DiscoveryOnly bool   `json:"discovery_only"`
}

func main() {
	var source string
	var allDue, force, discoveryOnly bool
	flag.StringVar(&source, "source", "", "source id")
	flag.BoolVar(&allDue, "all-due", false, "schedule all enabled sources")
	flag.BoolVar(&force, "force", false, "force unchanged artifacts")
	flag.BoolVar(&discoveryOnly, "discovery-only", false, "stop after discovery")
	flag.Parse()
	cfg, err := platform.LoadConfig()
	if err != nil {
		fatal(err)
	}
	logger := platform.NewLogger("ingestion-scheduler", cfg.Environment, cfg.Version)
	sourceConfigs, err := sources.LoadDir(cfg.SourcesDir)
	if err != nil {
		fatal(err)
	}
	var ids []string
	if source != "" {
		for _, id := range strings.Split(source, ",") {
			if _, ok := sourceConfigs[id]; !ok {
				fatal(fmt.Errorf("unknown source %q", id))
			}
			ids = append(ids, id)
		}
	} else if allDue {
		db, err := platform.OpenDatabase(context.Background(), cfg.DatabaseURL)
		if err != nil {
			fatal(err)
		}
		defer db.Close()
		now := time.Now().UTC()
		for id, c := range sourceConfigs {
			if !c.Enabled {
				continue
			}
			due, err := sourceDue(context.Background(), db, id, c.DeclaredFrequency, now)
			if err != nil {
				fatal(err)
			}
			if force || due {
				ids = append(ids, id)
			}
		}
	} else {
		fatal(fmt.Errorf("one of --source or --all-due is required"))
	}
	sortSourceIDs(ids)
	if len(ids) == 0 {
		logger.Info("no sources due")
		return
	}
	broker, err := messaging.NewBroker(cfg.RabbitMQURL, cfg.RabbitMQPrefetch, logger)
	if err != nil {
		fatal(err)
	}
	defer broker.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	correlation := uuid.New()
	for _, id := range ids {
		e, err := messaging.NewEnvelope("ingestion.requested", "ingestion-scheduler", correlation, nil, request{SourceID: id, Force: force, DiscoveryOnly: discoveryOnly})
		if err != nil {
			fatal(err)
		}
		if err := broker.Publish(ctx, e); err != nil {
			fatal(err)
		}
		logger.Info("ingestion requested", slog.String("source_id", id), slog.String("event_id", e.EventID.String()), slog.String("correlation_id", correlation.String()))
	}
}

func sourceDue(ctx context.Context, db *pgxpool.Pool, sourceID, frequency string, now time.Time) (bool, error) {
	var lastFinished *time.Time
	err := db.QueryRow(ctx, `
		SELECT max(finished_at)
		FROM ingestion_runs
		WHERE source_id = $1 AND status IN ('SUCCEEDED', 'UNCHANGED')`, sourceID).Scan(&lastFinished)
	if err != nil {
		return false, fmt.Errorf("read latest ingestion for %s: %w", sourceID, err)
	}
	if lastFinished == nil {
		return true, nil
	}
	var interval time.Duration
	switch strings.ToLower(strings.TrimSpace(frequency)) {
	case "daily":
		interval = 24 * time.Hour
	case "monthly":
		interval = 28 * 24 * time.Hour
	default:
		interval = 7 * 24 * time.Hour
	}
	return !lastFinished.Add(interval).After(now), nil
}

func sortSourceIDs(ids []string) {
	priority := map[string]int{
		"aifa-atc":                 0,
		"aifa-packages":            1,
		"aifa-package-ingredients": 2,
		"aifa-class-a":             3,
		"aifa-class-h":             3,
		"aifa-shortages":           4,
		"aifa-transparency-list":   5,
	}
	sort.SliceStable(ids, func(i, j int) bool {
		left, leftKnown := priority[ids[i]]
		right, rightKnown := priority[ids[j]]
		if leftKnown != rightKnown {
			return leftKnown
		}
		if left != right {
			return left < right
		}
		return ids[i] < ids[j]
	})
}

func fatal(err error) { fmt.Fprintln(os.Stderr, err); os.Exit(1) }
