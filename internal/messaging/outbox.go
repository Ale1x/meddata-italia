package messaging

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"log/slog"
	"time"
)

type OutboxPublisher struct {
	DB        *pgxpool.Pool
	Broker    *Broker
	Logger    *slog.Logger
	Interval  time.Duration
	BatchSize int
}

func (o *OutboxPublisher) Run(ctx context.Context) {
	if o.Interval == 0 {
		o.Interval = time.Second
	}
	if o.BatchSize == 0 {
		o.BatchSize = 50
	}
	ticker := time.NewTicker(o.Interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			_ = o.flush(ctx)
		}
	}
}
func (o *OutboxPublisher) flush(ctx context.Context) error {
	tx, err := o.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	rows, err := tx.Query(ctx, `SELECT event_id,event_type,event_version,correlation_id,causation_id,producer,occurred_at,payload,trace_context FROM outbox_events WHERE published_at IS NULL ORDER BY occurred_at FOR UPDATE SKIP LOCKED LIMIT $1`, o.BatchSize)
	if err != nil {
		return err
	}
	defer rows.Close()
	var events []Envelope
	for rows.Next() {
		var e Envelope
		var payload, trace []byte
		if err := rows.Scan(&e.EventID, &e.EventType, &e.EventVersion, &e.CorrelationID, &e.CausationID, &e.Producer, &e.OccurredAt, &payload, &trace); err != nil {
			return err
		}
		e.Payload = payload
		e.TraceContext = map[string]string{}
		_ = json.Unmarshal(trace, &e.TraceContext)
		events = append(events, e)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	for _, e := range events {
		if err := o.Broker.Publish(ctx, e); err != nil {
			_, _ = tx.Exec(ctx, `UPDATE outbox_events SET attempt_count=attempt_count+1,last_attempt_at=now(),last_error=$2 WHERE event_id=$1`, e.EventID, err.Error())
			_ = tx.Commit(ctx)
			return fmt.Errorf("publish outbox %s: %w", e.EventID, err)
		}
		if _, err := tx.Exec(ctx, `UPDATE outbox_events SET published_at=now(),attempt_count=attempt_count+1,last_attempt_at=now(),last_error=NULL WHERE event_id=$1`, e.EventID); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

var _ = uuid.Nil
