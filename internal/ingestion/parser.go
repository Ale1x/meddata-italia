package ingestion

import (
	"bytes"
	"crypto/sha256"
	"encoding/csv"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"github.com/Ale1x/meddata-italia/internal/profiling"
	"github.com/Ale1x/meddata-italia/internal/sources"
	"golang.org/x/text/encoding/charmap"
	"golang.org/x/text/transform"
	"io"
	"strings"
)

type ParsedRecord struct {
	Ordinal int64
	Key     string
	Hash    string
	Raw     map[string]string
	Payload map[string]string
}
type Parsed struct {
	Headers           []string
	NormalizedHeaders []string
	SchemaHash        string
	Records           []ParsedRecord
	Rejected          int
	Rejections        []map[string]any
}

func ParseArtifact(data []byte, cfg sources.Config) (Parsed, error) {
	var reader io.Reader = bytes.NewReader(data)
	if strings.EqualFold(cfg.Parser.Encoding, "windows-1252") {
		reader = transform.NewReader(reader, charmap.Windows1252.NewDecoder())
	}
	r := csv.NewReader(reader)
	r.Comma = ';'
	r.FieldsPerRecord = -1
	r.LazyQuotes = true
	for range cfg.Parser.SkipRecords {
		if _, err := r.Read(); err != nil {
			return Parsed{}, err
		}
	}
	headers, err := r.Read()
	if err != nil {
		return Parsed{}, fmt.Errorf("read header: %w", err)
	}
	normalized := make([]string, len(headers))
	seen := map[string]bool{}
	for i, h := range headers {
		headers[i] = strings.TrimSpace(strings.ReplaceAll(h, "\n", " "))
		normalized[i] = semanticHeader(cfg.Parser.Type, profiling.NormalizeName(headers[i]))
		if seen[normalized[i]] {
			return Parsed{}, fmt.Errorf("normalized header collision: %s", normalized[i])
		}
		seen[normalized[i]] = true
	}
	schema := sha256.Sum256([]byte(strings.Join(normalized, "\x1f")))
	out := Parsed{Headers: headers, NormalizedHeaders: normalized, SchemaHash: hex.EncodeToString(schema[:])}
	for ordinal := int64(1); ; ordinal++ {
		row, err := r.Read()
		if err == io.EOF {
			break
		}
		if err != nil || len(row) != len(headers) {
			out.Rejected++
			detail := "wrong column count"
			if err != nil {
				detail = err.Error()
			}
			out.Rejections = append(out.Rejections, map[string]any{"ordinal": ordinal, "error": detail})
			continue
		}
		raw := map[string]string{}
		payload := map[string]string{}
		for i, v := range row {
			v = strings.TrimSpace(v)
			raw[headers[i]] = v
			payload[normalized[i]] = v
		}
		b, _ := json.Marshal(raw)
		sum := sha256.Sum256(b)
		key := recordKey(payload, ordinal)
		out.Records = append(out.Records, ParsedRecord{Ordinal: ordinal, Key: key, Hash: hex.EncodeToString(sum[:]), Raw: raw, Payload: payload})
	}
	return out, nil
}
func semanticHeader(parser, name string) string {
	if parser == "aifa-transparency" && strings.HasPrefix(name, "prezzo_pubblico_") {
		return "prezzo_pubblico"
	}
	if name == "codice_aic" {
		return "aic"
	}
	return name
}
func recordKey(m map[string]string, ordinal int64) string {
	for _, k := range []string{"aic", "codice_atc"} {
		if v := m[k]; v != "" {
			return fmt.Sprintf("%s:%d", v, ordinal)
		}
	}
	return fmt.Sprintf("row:%d", ordinal)
}
