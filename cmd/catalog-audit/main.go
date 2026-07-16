package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"time"

	"github.com/Ale1x/meddata-italia/internal/catalogaudit"
	"github.com/Ale1x/meddata-italia/internal/platform"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	format := flag.String("format", "text", "output format: text or json")
	examples := flag.Int("examples", 5, "maximum examples per finding")
	strict := flag.Bool("strict", false, "exit unsuccessfully for warnings too")
	timeout := flag.Duration("timeout", 5*time.Minute, "maximum audit duration")
	flag.Parse()

	if *format != "text" && *format != "json" {
		fmt.Fprintln(os.Stderr, "format must be text or json")
		os.Exit(2)
	}
	cfg, err := platform.LoadConfig()
	if err != nil {
		fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), *timeout)
	defer cancel()
	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		fatal(fmt.Errorf("connect database: %w", err))
	}
	defer pool.Close()
	if err := pool.Ping(ctx); err != nil {
		fatal(fmt.Errorf("ping database: %w", err))
	}
	report, err := catalogaudit.Run(ctx, pool, *examples)
	if err != nil {
		fatal(err)
	}
	if *format == "json" {
		encoder := json.NewEncoder(os.Stdout)
		encoder.SetIndent("", "  ")
		if err := encoder.Encode(report); err != nil {
			fatal(err)
		}
	} else {
		printText(report)
	}
	if report.ErrorCount() > 0 || (*strict && report.WarningCount() > 0) {
		os.Exit(1)
	}
}

func printText(report catalogaudit.Report) {
	summary := report.Summary
	fmt.Printf("Catalog audit: %d packages in %s\n", summary.Packages, report.Duration)
	fmt.Printf("  official equivalents: %d\n", summary.OfficialRecommendations)
	fmt.Printf("  same-substance fallback: %d\n", summary.SameSubstanceRecommendations)
	fmt.Printf("  no related results: %d\n", summary.NoRecommendations)
	fmt.Printf("  active substances: %d (largest set: %d packages)\n", summary.ActiveSubstances, summary.MaxPackagesForOneSubstance)
	fmt.Printf("  current official groups: %d (%d memberships)\n", summary.CurrentOfficialGroups, summary.CurrentOfficialMemberships)
	if len(report.Findings) == 0 {
		fmt.Println("No findings.")
		return
	}
	fmt.Println("Findings:")
	for _, finding := range report.Findings {
		fmt.Printf("  [%s] %s: %d — %s\n", finding.Severity, finding.Code, finding.Count, finding.Detail)
		for _, example := range finding.Examples {
			fmt.Printf("    - %s\n", example)
		}
	}
}

func fatal(err error) {
	fmt.Fprintln(os.Stderr, err)
	os.Exit(2)
}
