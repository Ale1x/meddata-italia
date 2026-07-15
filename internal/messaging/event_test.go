package messaging

import (
	"github.com/google/uuid"
	"testing"
)

func TestEnvelopeRoundTrip(t *testing.T) {
	e, err := NewEnvelope("ingestion.requested", "test", uuid.Nil, nil, map[string]any{"source_id": "aifa-packages"})
	if err != nil {
		t.Fatal(err)
	}
	b, err := e.Bytes()
	if err != nil {
		t.Fatal(err)
	}
	got, err := Decode(b)
	if err != nil {
		t.Fatal(err)
	}
	if got.EventID != e.EventID || got.EventType != e.EventType {
		t.Fatalf("round trip mismatch")
	}
}
