package messaging

import (
	"encoding/json"
	"fmt"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
	"time"
)

type Envelope struct {
	EventID       uuid.UUID         `json:"event_id" validate:"required"`
	EventType     string            `json:"event_type" validate:"required"`
	EventVersion  int               `json:"event_version" validate:"gte=1"`
	OccurredAt    time.Time         `json:"occurred_at" validate:"required"`
	CorrelationID uuid.UUID         `json:"correlation_id" validate:"required"`
	CausationID   *uuid.UUID        `json:"causation_id,omitempty"`
	Producer      string            `json:"producer" validate:"required"`
	TraceContext  map[string]string `json:"trace_context"`
	Payload       json.RawMessage   `json:"payload" validate:"required"`
}

func NewEnvelope(eventType, producer string, correlation uuid.UUID, causation *uuid.UUID, payload any) (Envelope, error) {
	if correlation == uuid.Nil {
		correlation = uuid.New()
	}
	b, err := json.Marshal(payload)
	if err != nil {
		return Envelope{}, err
	}
	e := Envelope{EventID: uuid.New(), EventType: eventType, EventVersion: 1, OccurredAt: time.Now().UTC(), CorrelationID: correlation, CausationID: causation, Producer: producer, TraceContext: map[string]string{}, Payload: b}
	if err := validator.New().Struct(e); err != nil {
		return Envelope{}, fmt.Errorf("validate event: %w", err)
	}
	return e, nil
}
func (e Envelope) Bytes() ([]byte, error) { return json.Marshal(e) }
func Decode(data []byte) (Envelope, error) {
	var e Envelope
	if err := json.Unmarshal(data, &e); err != nil {
		return e, err
	}
	if err := validator.New().Struct(e); err != nil {
		return e, fmt.Errorf("validate event: %w", err)
	}
	return e, nil
}
