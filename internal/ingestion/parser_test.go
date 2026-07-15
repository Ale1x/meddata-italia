package ingestion

import (
	"github.com/example/medicine-platform/internal/sources"
	"testing"
)

func TestParseTransparencyDynamicPriceHeader(t *testing.T) {
	data := []byte("AIC;Prezzo Pubblico 15 luglio 2026;Codice gruppo equivalenza\r\n12345678;4,50 €;AAA\r\n")
	got, err := ParseArtifact(data, sources.Config{Parser: sources.ParserConfig{Type: "aifa-transparency", Encoding: "utf-8"}})
	if err != nil {
		t.Fatal(err)
	}
	if got.NormalizedHeaders[1] != "prezzo_pubblico" {
		t.Fatalf("header=%s", got.NormalizedHeaders[1])
	}
	if got.Records[0].Payload["aic"] != "12345678" {
		t.Fatal("AIC lost")
	}
}
