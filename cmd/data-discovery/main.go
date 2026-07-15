package main

import (
	"archive/zip"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/example/medicine-platform/internal/profiling"
)

type joinResult struct {
	LeftDataset            string   `json:"left_dataset"`
	RightDataset           string   `json:"right_dataset"`
	LeftColumn             string   `json:"left_column"`
	RightColumn            string   `json:"right_column"`
	LeftDistinct           int      `json:"left_distinct"`
	RightDistinct          int      `json:"right_distinct"`
	CommonKeys             int      `json:"common_keys"`
	MissingLeft            int      `json:"missing_left"`
	MissingRight           int      `json:"missing_right"`
	LeftDuplicateKeys      int      `json:"left_duplicate_keys"`
	RightDuplicateKeys     int      `json:"right_duplicate_keys"`
	LeftMatchPercent       float64  `json:"left_match_percent"`
	RightMatchPercent      float64  `json:"right_match_percent"`
	ObservedCardinality    string   `json:"observed_cardinality"`
	UnmatchedLeftExamples  []string `json:"unmatched_left_examples"`
	UnmatchedRightExamples []string `json:"unmatched_right_examples"`
}

type snapshotDiff struct {
	From              string `json:"from"`
	To                string `json:"to"`
	HeaderChanged     bool   `json:"header_changed"`
	Added             int    `json:"added"`
	Removed           int    `json:"removed"`
	Modified          int    `json:"modified"`
	Unchanged         int    `json:"unchanged"`
	GroupsAdded       int    `json:"groups_added"`
	GroupsRemoved     int    `json:"groups_removed"`
	MembershipChanges int    `json:"membership_changes"`
}

func main() {
	input := "/tmp/med-discovery"
	output := "docs/data-discovery/generated"
	if len(os.Args) > 1 {
		input = os.Args[1]
	}
	if len(os.Args) > 2 {
		output = os.Args[2]
	}
	if err := os.MkdirAll(filepath.Join(output, "profiles"), 0o755); err != nil {
		panic(err)
	}
	if err := os.MkdirAll(filepath.Join(output, "samples"), 0o755); err != nil {
		panic(err)
	}
	specs := []profiling.DatasetSpec{
		{ID: "aifa-transparency-list", Path: filepath.Join(input, "transparency.csv"), URL: "https://www.aifa.gov.it/documents/20142/825643/Lista_farmaci_equivalenti.csv", Encoding: "windows-1252"},
		{ID: "aifa-packages", Path: filepath.Join(input, "packages.csv"), URL: "https://drive.aifa.gov.it/farmaci/confezioni_fornitura.csv"},
		{ID: "aifa-package-ingredients", Path: filepath.Join(input, "ingredients.csv"), URL: "https://drive.aifa.gov.it/farmaci/PA_confezioni.csv"},
		{ID: "aifa-atc", Path: filepath.Join(input, "atc.csv"), URL: "https://drive.aifa.gov.it/farmaci/atc.csv"},
		{ID: "aifa-shortages", Path: filepath.Join(input, "shortages.csv"), URL: "https://www.aifa.gov.it/documents/20142/847339/elenco_medicinali_carenti.csv", SkipRecords: 2, Encoding: "windows-1252"},
		{ID: "aifa-class-a-pa", Path: filepath.Join(input, "class-a-pa.csv"), URL: "https://www.aifa.gov.it/documents/20142/3815901/Classe_A_per_principio_attivo_28-02-2026.csv", Encoding: "windows-1252"},
		{ID: "aifa-class-a-name", Path: filepath.Join(input, "class-a-name.csv"), URL: "https://www.aifa.gov.it/documents/20142/3815901/Classe_A_per_nome_commerciale_28-02-2026.csv", Encoding: "windows-1252"},
		{ID: "aifa-class-h-pa", Path: filepath.Join(input, "class-h-pa.csv"), URL: "https://www.aifa.gov.it/documents/20142/3815901/Classe_H_per_principio_attivo_28-02-2026.csv", Encoding: "windows-1252"},
		{ID: "aifa-class-h-name", Path: filepath.Join(input, "class-h-name.csv"), URL: "https://www.aifa.gov.it/documents/20142/3815901/Classe_H_per_nome_commerciale_28-02-2026.csv", Encoding: "windows-1252"},
	}
	tables := map[string]profiling.Table{}
	profiles := map[string]profiling.Profile{}
	for _, spec := range specs {
		table, profile, err := profiling.Read(spec)
		if err != nil {
			panic(fmt.Errorf("%s: %w", spec.ID, err))
		}
		tables[spec.ID] = table
		profiles[spec.ID] = profile
		must(profiling.WriteJSON(filepath.Join(output, "profiles", spec.ID+".json"), profile))
		must(profiling.WriteSample(filepath.Join(output, "samples", spec.ID+".jsonl"), table, 25))
		fmt.Printf("%-28s rows=%d cols=%d malformed=%d sha=%s\n", spec.ID, profile.RowCount, profile.ColumnCount, profile.MalformedRows, profile.SHA256)
	}
	joins := []joinResult{
		join(tables, "aifa-packages", "codice_aic", "aifa-package-ingredients", "codice_aic"),
		join(tables, "aifa-packages", "codice_atc", "aifa-atc", "codice_atc"),
		join(tables, "aifa-transparency-list", "aic", "aifa-packages", "codice_aic"),
		join(tables, "aifa-shortages", "codice_aic", "aifa-packages", "codice_aic"),
		join(tables, "aifa-class-a-pa", "aic", "aifa-packages", "codice_aic"),
		join(tables, "aifa-class-h-pa", "codice_aic", "aifa-packages", "codice_aic"),
	}
	must(profiling.WriteJSON(filepath.Join(output, "join-analysis.json"), joins))
	diffSpecs := []profiling.DatasetSpec{
		{ID: "2025-01-15", Path: filepath.Join(input, "transparency-old.csv"), Encoding: "windows-1252"},
		{ID: "2026-03-16", Path: filepath.Join(input, "transparency-prev2.csv"), Encoding: "windows-1252"},
		{ID: "2026-04-15", Path: filepath.Join(input, "transparency-prev.csv"), Encoding: "windows-1252"},
		{ID: "2026-07-15", Path: filepath.Join(input, "transparency.csv"), Encoding: "windows-1252"},
	}
	var snapshots []struct {
		id    string
		table profiling.Table
	}
	for _, spec := range diffSpecs {
		t, _, err := profiling.Read(spec)
		if err != nil {
			panic(err)
		}
		snapshots = append(snapshots, struct {
			id    string
			table profiling.Table
		}{spec.ID, t})
	}
	var diffs []snapshotDiff
	for i := 1; i < len(snapshots); i++ {
		diffs = append(diffs, diff(snapshots[i-1].id, snapshots[i-1].table, snapshots[i].id, snapshots[i].table))
	}
	must(profiling.WriteJSON(filepath.Join(output, "snapshot-comparison.json"), diffs))
	summary := map[string]any{"profiles": profiles, "joins": joins, "snapshot_diffs": diffs}
	must(profiling.WriteJSON(filepath.Join(output, "discovery-summary.json"), summary))
	archivePath := filepath.Join(input, "shortages-2025.zip")
	if _, err := os.Stat(archivePath); err == nil {
		history, err := inspectShortageArchive(archivePath)
		if err != nil {
			panic(err)
		}
		must(profiling.WriteJSON(filepath.Join(output, "shortages-history-2025.json"), history))
		fmt.Printf("%-28s snapshots=%v hash=%v\n", "aifa-shortages-history", history["snapshot_count"], history["sha256"])
	}
}

func inspectShortageArchive(path string) (map[string]any, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	sum := sha256.Sum256(raw)
	zr, err := zip.OpenReader(path)
	if err != nil {
		return nil, err
	}
	defer zr.Close()
	type snap struct {
		name     string
		sequence int
		rows     int
		header   []string
	}
	var snapshots []snap
	headerVariants := map[string]int{}
	for _, file := range zr.File {
		if !strings.Contains(file.Name, "/6_Elenco_farmaci_carenti") || !strings.HasSuffix(strings.ToLower(file.Name), ".xlsx") {
			continue
		}
		prefix := strings.SplitN(file.Name, "_", 2)[0]
		sequence := 0
		_, _ = fmt.Sscanf(prefix, "%d", &sequence)
		reader, err := file.Open()
		if err != nil {
			return nil, err
		}
		data, err := io.ReadAll(reader)
		reader.Close()
		if err != nil {
			return nil, err
		}
		rows, err := profiling.ReadXLSX(data)
		if err != nil {
			return nil, fmt.Errorf("%s: %w", file.Name, err)
		}
		header := findShortageHeader(rows)
		count := 0
		if len(header) > 0 {
			for _, row := range rows {
				if len(row) > 1 && strings.TrimSpace(row[1]) != "" {
					count++
				}
			}
			count--
		}
		key := strings.Join(header, "|")
		headerVariants[key]++
		snapshots = append(snapshots, snap{name: file.Name, sequence: sequence, rows: count, header: header})
	}
	sort.Slice(snapshots, func(i, j int) bool { return snapshots[i].sequence < snapshots[j].sequence })
	if len(snapshots) == 0 {
		return nil, fmt.Errorf("no complete shortage snapshots")
	}
	minRows, maxRows := snapshots[0].rows, snapshots[0].rows
	for _, s := range snapshots {
		if s.rows < minRows {
			minRows = s.rows
		}
		if s.rows > maxRows {
			maxRows = s.rows
		}
	}
	variants := make([]map[string]any, 0, len(headerVariants))
	for header, count := range headerVariants {
		variants = append(variants, map[string]any{"header": strings.Split(header, "|"), "snapshots": count})
	}
	return map[string]any{"artifact": path, "sha256": fmt.Sprintf("%x", sum), "size_bytes": len(raw), "snapshot_count": len(snapshots), "first": map[string]any{"name": snapshots[0].name, "rows": snapshots[0].rows, "header": snapshots[0].header}, "last": map[string]any{"name": snapshots[len(snapshots)-1].name, "rows": snapshots[len(snapshots)-1].rows, "header": snapshots[len(snapshots)-1].header}, "min_rows": minRows, "max_rows": maxRows, "header_variants": variants}, nil
}
func findShortageHeader(rows [][]string) []string {
	for _, row := range rows {
		for _, cell := range row {
			n := profiling.NormalizeName(cell)
			if n == "codice_aic" || n == "aic" {
				out := make([]string, len(row))
				for i, v := range row {
					out[i] = strings.TrimSpace(v)
				}
				return out
			}
		}
	}
	return nil
}

func join(tables map[string]profiling.Table, leftID, leftCol, rightID, rightCol string) joinResult {
	l, r := tables[leftID], tables[rightID]
	li, ri := profiling.ColumnIndex(l, leftCol), profiling.ColumnIndex(r, rightCol)
	if li < 0 || ri < 0 {
		panic(fmt.Sprintf("join column missing: %s.%s=%d %s.%s=%d", leftID, leftCol, li, rightID, rightCol, ri))
	}
	norm := profiling.NormalizeAIC
	if strings.Contains(leftCol, "atc") {
		norm = func(s string) string { return strings.ToUpper(strings.TrimSpace(s)) }
	}
	lv, rv := profiling.Values(l, li, norm), profiling.Values(r, ri, norm)
	common := 0
	var missingL, missingR []string
	for k := range lv {
		if _, ok := rv[k]; ok {
			common++
		} else {
			missingL = append(missingL, k)
		}
	}
	for k := range rv {
		if _, ok := lv[k]; !ok {
			missingR = append(missingR, k)
		}
	}
	sort.Strings(missingL)
	sort.Strings(missingR)
	ldup, rdup := 0, 0
	for _, n := range lv {
		if n > 1 {
			ldup++
		}
	}
	for _, n := range rv {
		if n > 1 {
			rdup++
		}
	}
	card := "one-to-one"
	if ldup > 0 && rdup > 0 {
		card = "many-to-many"
	} else if ldup > 0 {
		card = "many-to-one"
	} else if rdup > 0 {
		card = "one-to-many"
	}
	return joinResult{LeftDataset: leftID, RightDataset: rightID, LeftColumn: l.Header[li], RightColumn: r.Header[ri], LeftDistinct: len(lv), RightDistinct: len(rv), CommonKeys: common, MissingLeft: len(missingL), MissingRight: len(missingR), LeftDuplicateKeys: ldup, RightDuplicateKeys: rdup, LeftMatchPercent: pct(common, len(lv)), RightMatchPercent: pct(common, len(rv)), ObservedCardinality: card, UnmatchedLeftExamples: first(missingL, 10), UnmatchedRightExamples: first(missingR, 10)}
}

func diff(fromID string, from profiling.Table, toID string, to profiling.Table) snapshotDiff {
	fi, ti := profiling.ColumnIndex(from, "aic"), profiling.ColumnIndex(to, "aic")
	fg, tg := profiling.ColumnIndex(from, "codice_gruppo_equivalenza"), profiling.ColumnIndex(to, "codice_gruppo_equivalenza")
	fm, tm := map[string]string{}, map[string]string{}
	fgroups, tgroups := map[string]bool{}, map[string]bool{}
	for _, row := range from.Rows {
		k := profiling.NormalizeAIC(row[fi])
		fm[k] = strings.Join(row, "\x1f")
		if fg >= 0 {
			fgroups[row[fg]] = true
		}
	}
	for _, row := range to.Rows {
		k := profiling.NormalizeAIC(row[ti])
		tm[k] = strings.Join(row, "\x1f")
		if tg >= 0 {
			tgroups[row[tg]] = true
		}
	}
	d := snapshotDiff{From: fromID, To: toID, HeaderChanged: strings.Join(from.Normalized, "|") != strings.Join(to.Normalized, "|")}
	for k, v := range fm {
		tv, ok := tm[k]
		if !ok {
			d.Removed++
		} else if v == tv {
			d.Unchanged++
		} else {
			d.Modified++
			if groupOf(from, fi, fg, k) != groupOf(to, ti, tg, k) {
				d.MembershipChanges++
			}
		}
	}
	for k := range tm {
		if _, ok := fm[k]; !ok {
			d.Added++
		}
	}
	for g := range fgroups {
		if !tgroups[g] {
			d.GroupsRemoved++
		}
	}
	for g := range tgroups {
		if !fgroups[g] {
			d.GroupsAdded++
		}
	}
	return d
}

func groupOf(t profiling.Table, keyCol, groupCol int, key string) string {
	for _, r := range t.Rows {
		if profiling.NormalizeAIC(r[keyCol]) == key {
			return r[groupCol]
		}
	}
	return ""
}
func first(v []string, n int) []string {
	if len(v) > n {
		return v[:n]
	}
	return v
}
func pct(a, b int) float64 {
	if b == 0 {
		return 0
	}
	return float64(a) * 100 / float64(b)
}
func must(err error) {
	if err != nil {
		panic(err)
	}
}

var _ = json.Valid
