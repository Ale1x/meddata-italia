package platform

import (
	"context"
	"fmt"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/trace"
)

func SetupTelemetry(context.Context, string) (func(context.Context) error, error) {
	provider := trace.NewTracerProvider()
	otel.SetTracerProvider(provider)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(propagation.TraceContext{}, propagation.Baggage{}))
	return func(ctx context.Context) error {
		if err := provider.Shutdown(ctx); err != nil {
			return fmt.Errorf("shutdown tracing: %w", err)
		}
		return nil
	}, nil
}
