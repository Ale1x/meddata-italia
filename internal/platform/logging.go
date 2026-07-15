package platform

import (
	"log/slog"
	"os"
)

func NewLogger(service, environment, version string) *slog.Logger {
	return slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})).With(
		"service", service, "environment", environment, "version", version,
	)
}
