package profiling

import (
	"bufio"
	"bytes"
	"crypto/sha256"
	"encoding/csv"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode"
)

type DatasetSpec struct {
	ID          string
	Path        string
	URL         string
	SkipRecords int
	Encoding    string
}

type ValueCount struct {
	Value string `json:"value"`
	Count int    `json:"count"`
}

type ColumnProfile struct {
	Position       int          `json:"position"`
	OriginalName   string       `json:"original_name"`
	NormalizedName string       `json:"normalized_name"`
	InferredType   string       `json:"inferred_type"`
	NullCount      int          `json:"null_count"`
	NullPercent    float64      `json:"null_percent"`
	DistinctCount  int          `json:"distinct_count"`
	Unique         bool         `json:"unique"`
	MinLength      int          `json:"min_length"`
	MaxLength      int          `json:"max_length"`
	TopValues      []ValueCount `json:"top_values"`
	Examples       []string     `json:"examples"`
	Patterns       []string     `json:"patterns,omitempty"`
}

type Profile struct {
	DatasetID        string          `json:"dataset_id"`
	ArtifactURL      string          `json:"artifact_url"`
	SHA256           string          `json:"sha256"`
	SizeBytes        int64           `json:"size_bytes"`
	Encoding         string          `json:"encoding"`
	Delimiter        string          `json:"delimiter"`
	Quoting          string          `json:"quoting"`
	Newline          string          `json:"newline"`
	BOM              bool            `json:"bom"`
	RowCount         int             `json:"row_count"`
	ColumnCount      int             `json:"column_count"`
	MalformedRows    int             `json:"malformed_rows"`
	DuplicateRows    int             `json:"duplicate_rows"`
	HeaderCollisions []string        `json:"header_collisions,omitempty"`
	Columns          []ColumnProfile `json:"columns"`
}

type Table struct {
	Header     []string
	Normalized []string
	Rows       [][]string
}

var (
	integerRE = regexp.MustCompile(`^[+-]?[0-9]+$`)
	decimalRE = regexp.MustCompile(`^[+-]?[0-9]+(?:[.,][0-9]+)?$`)
	aicRE     = regexp.MustCompile(`^[0-9]{9}$`)
	atcRE     = regexp.MustCompile(`^[A-Z][0-9]{2}[A-Z]{2}[0-9]{2}$`)
)

func Read(spec DatasetSpec) (Table, Profile, error) {
	raw, err := os.ReadFile(spec.Path)
	if err != nil {
		return Table{}, Profile{}, err
	}
	info, err := os.Stat(spec.Path)
	if err != nil {
		return Table{}, Profile{}, err
	}
	sum := sha256.Sum256(raw)
	bom := bytes.HasPrefix(raw, []byte{0xef, 0xbb, 0xbf}) || bytes.HasPrefix(raw, []byte{0xff, 0xfe})
	decoded := decode(raw, spec.Encoding)
	delim := detectDelimiter(decoded)
	r := csv.NewReader(bytes.NewReader(decoded))
	r.Comma = delim
	r.FieldsPerRecord = -1
	r.ReuseRecord = false
	r.LazyQuotes = true
	for range spec.SkipRecords {
		if _, err := r.Read(); err != nil {
			return Table{}, Profile{}, fmt.Errorf("skip preamble: %w", err)
		}
	}
	header, err := r.Read()
	if err != nil {
		return Table{}, Profile{}, fmt.Errorf("read header: %w", err)
	}
	for i := range header {
		header[i] = strings.TrimSpace(strings.ReplaceAll(header[i], "\n", " "))
	}
	norm := make([]string, len(header))
	seenHeaders := map[string]int{}
	var collisions []string
	for i, h := range header {
		norm[i] = NormalizeName(h)
		seenHeaders[norm[i]]++
		if seenHeaders[norm[i]] > 1 {
			collisions = append(collisions, norm[i])
		}
	}
	var rows [][]string
	malformed := 0
	for {
		record, readErr := r.Read()
		if errors.Is(readErr, io.EOF) {
			break
		}
		if readErr != nil {
			malformed++
			continue
		}
		if len(record) != len(header) {
			malformed++
			continue
		}
		for i := range record {
			record[i] = strings.TrimSpace(record[i])
		}
		rows = append(rows, record)
	}
	table := Table{Header: header, Normalized: norm, Rows: rows}
	profile := Profile{
		DatasetID: spec.ID, ArtifactURL: spec.URL, SHA256: hex.EncodeToString(sum[:]),
		SizeBytes: info.Size(), Encoding: normalizedEncoding(spec.Encoding), Delimiter: string(delim),
		Quoting: `RFC4180 double-quote`, Newline: detectNewline(raw), BOM: bom,
		RowCount: len(rows), ColumnCount: len(header), MalformedRows: malformed,
		HeaderCollisions: collisions,
	}
	profile.DuplicateRows = duplicateRows(rows)
	profile.Columns = profileColumns(table)
	return table, profile, nil
}

func WriteJSON(path string, value any) error {
	b, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	b = append(b, '\n')
	return os.WriteFile(path, b, 0o644)
}

func WriteSample(path string, table Table, limit int) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	w := bufio.NewWriter(f)
	defer w.Flush()
	if limit > len(table.Rows) {
		limit = len(table.Rows)
	}
	enc := json.NewEncoder(w)
	for _, row := range table.Rows[:limit] {
		m := make(map[string]string, len(row))
		for i, value := range row {
			m[table.Normalized[i]] = value
		}
		if err := enc.Encode(m); err != nil {
			return err
		}
	}
	return nil
}

func NormalizeName(s string) string {
	s = strings.TrimSpace(strings.ToLower(s))
	var b strings.Builder
	underscore := false
	for _, r := range s {
		switch {
		case unicode.IsLetter(r) || unicode.IsDigit(r):
			b.WriteRune(foldRune(r))
			underscore = false
		case !underscore && b.Len() > 0:
			b.WriteByte('_')
			underscore = true
		}
	}
	return strings.Trim(b.String(), "_")
}

func ColumnIndex(t Table, candidates ...string) int {
	for _, candidate := range candidates {
		candidate = NormalizeName(candidate)
		for i, name := range t.Normalized {
			if name == candidate {
				return i
			}
		}
	}
	return -1
}

func Values(t Table, index int, normalize func(string) string) map[string]int {
	out := map[string]int{}
	if index < 0 {
		return out
	}
	for _, row := range t.Rows {
		v := row[index]
		if normalize != nil {
			v = normalize(v)
		}
		if v != "" {
			out[v]++
		}
	}
	return out
}

func NormalizeAIC(s string) string {
	var b strings.Builder
	for _, r := range strings.TrimSpace(s) {
		if unicode.IsDigit(r) {
			b.WriteRune(r)
		}
	}
	v := b.String()
	if len(v) > 0 && len(v) < 9 {
		v = strings.Repeat("0", 9-len(v)) + v
	}
	return v
}

func profileColumns(t Table) []ColumnProfile {
	profiles := make([]ColumnProfile, len(t.Header))
	for col := range t.Header {
		counts := map[string]int{}
		nullCount, minLen, maxLen := 0, -1, 0
		typeKind := "integer"
		patterns := map[string]bool{}
		for _, row := range t.Rows {
			v := row[col]
			if isNull(v) {
				nullCount++
				continue
			}
			counts[v]++
			l := len([]rune(v))
			if minLen == -1 || l < minLen {
				minLen = l
			}
			if l > maxLen {
				maxLen = l
			}
			typeKind = mergeType(typeKind, inferValueType(v))
			if aicRE.MatchString(v) {
				patterns["AIC_9_DIGITS"] = true
			}
			if atcRE.MatchString(strings.ToUpper(v)) {
				patterns["ATC_LEVEL_5"] = true
			}
		}
		if minLen == -1 {
			minLen = 0
		}
		profiles[col] = ColumnProfile{
			Position: col + 1, OriginalName: t.Header[col], NormalizedName: t.Normalized[col],
			InferredType: typeKind, NullCount: nullCount,
			NullPercent: percent(nullCount, len(t.Rows)), DistinctCount: len(counts),
			Unique: nullCount == 0 && len(counts) == len(t.Rows), MinLength: minLen, MaxLength: maxLen,
			TopValues: top(counts, 5), Examples: examples(counts, 5), Patterns: sortedKeys(patterns),
		}
	}
	return profiles
}

func inferValueType(v string) string {
	if integerRE.MatchString(v) {
		return "integer-like text"
	}
	if decimalRE.MatchString(v) {
		return "decimal-like text"
	}
	for _, layout := range []string{"02/01/2006", "2006-01-02", "02-01-2006"} {
		if _, err := time.Parse(layout, v); err == nil {
			return "date-like text"
		}
	}
	return "text"
}

func mergeType(a, b string) string {
	if a == b {
		return a
	}
	if (a == "integer-like text" && b == "decimal-like text") || (a == "decimal-like text" && b == "integer-like text") {
		return "decimal-like text"
	}
	return "text"
}

func isNull(v string) bool {
	v = strings.TrimSpace(strings.ToLower(v))
	return v == "" || v == "null" || v == "n/a" || v == "-"
}

func top(counts map[string]int, limit int) []ValueCount {
	values := make([]ValueCount, 0, len(counts))
	for v, c := range counts {
		values = append(values, ValueCount{Value: v, Count: c})
	}
	sort.Slice(values, func(i, j int) bool {
		if values[i].Count == values[j].Count {
			return values[i].Value < values[j].Value
		}
		return values[i].Count > values[j].Count
	})
	if len(values) > limit {
		values = values[:limit]
	}
	return values
}

func examples(counts map[string]int, limit int) []string {
	values := make([]string, 0, len(counts))
	for v := range counts {
		values = append(values, v)
	}
	sort.Strings(values)
	if len(values) > limit {
		values = values[:limit]
	}
	return values
}

func duplicateRows(rows [][]string) int {
	seen := map[string]int{}
	duplicates := 0
	for _, row := range rows {
		key := strings.Join(row, "\x1f")
		if seen[key] > 0 {
			duplicates++
		}
		seen[key]++
	}
	return duplicates
}

func detectDelimiter(data []byte) rune {
	line := data
	if i := bytes.IndexByte(data, '\n'); i >= 0 {
		line = data[:i]
	}
	if bytes.Count(line, []byte(";")) >= bytes.Count(line, []byte(",")) {
		return ';'
	}
	return ','
}

func detectNewline(raw []byte) string {
	crlf := bytes.Count(raw, []byte("\r\n"))
	lf := bytes.Count(raw, []byte("\n"))
	if crlf > 0 && crlf == lf {
		return "CRLF"
	}
	if crlf > 0 {
		return "MIXED"
	}
	return "LF"
}

func normalizedEncoding(enc string) string {
	if strings.EqualFold(enc, "windows-1252") {
		return "Windows-1252"
	}
	return "UTF-8/ASCII"
}

func percent(part, total int) float64 {
	if total == 0 {
		return 0
	}
	v, _ := strconv.ParseFloat(fmt.Sprintf("%.4f", float64(part)*100/float64(total)), 64)
	return v
}

func sortedKeys(m map[string]bool) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

func foldRune(r rune) rune {
	switch r {
	case 'à', 'á', 'â', 'ä':
		return 'a'
	case 'è', 'é', 'ê', 'ë':
		return 'e'
	case 'ì', 'í', 'î', 'ï':
		return 'i'
	case 'ò', 'ó', 'ô', 'ö':
		return 'o'
	case 'ù', 'ú', 'û', 'ü':
		return 'u'
	default:
		return r
	}
}

func decode(raw []byte, enc string) []byte {
	if !strings.EqualFold(enc, "windows-1252") {
		return bytes.TrimPrefix(raw, []byte{0xef, 0xbb, 0xbf})
	}
	var b strings.Builder
	b.Grow(len(raw))
	for _, c := range raw {
		if c < 0x80 {
			b.WriteByte(c)
			continue
		}
		if c >= 0xa0 {
			b.WriteRune(rune(c))
			continue
		}
		if r, ok := cp1252[c]; ok {
			b.WriteRune(r)
		} else {
			b.WriteRune(unicode.ReplacementChar)
		}
	}
	return []byte(b.String())
}

var cp1252 = map[byte]rune{
	0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…', 0x86: '†', 0x87: '‡', 0x88: 'ˆ', 0x89: '‰', 0x8a: 'Š', 0x8b: '‹', 0x8c: 'Œ', 0x8e: 'Ž',
	0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—', 0x98: '˜', 0x99: '™', 0x9a: 'š', 0x9b: '›', 0x9c: 'œ', 0x9e: 'ž', 0x9f: 'Ÿ',
}
