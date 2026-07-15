# Data quality report

Generated from artifacts acquired on 2026-07-15. Machine-readable profiles and safe samples are under `generated/`. Severity describes impact on the selected MVP, not AIFA data quality in general.

## BLOCKING

None for the package lookup → official equivalence vertical slice.

## HIGH

- **AIC representation differs by source.** Transparency AIC values have length 7–8 because leading zeroes are omitted; package, ingredients, shortage and A/H AIC values have exactly 9 digits. Store AIC as text, retain `source_value`, accept only digits, and left-pad to 9 for the canonical business key. Numeric database types are forbidden.
- **Transparency/anagraphic snapshot mismatch.** 99 of 8,508 transparency AICs (1.164%) do not occur in the daily package snapshot. Publication must create explicit unresolved memberships/warnings, never silently drop or invent a package. A later compatible package snapshot can reconcile them.
- **Ingredient scope exceeds package scope.** The ingredient file has 299,299 distinct AICs, of which 139,441 are absent from the current package file. The package side nevertheless has 100% ingredient-key coverage. Treat each input as an independent snapshot; do not enforce a staging FK from all ingredient records to the current package artifact.

## MEDIUM

- `PA_confezioni` contains 52,926 `N.D.` substance rows; 156,331 null-equivalent quantities and 133,262 null-equivalent units. An ingredient association can exist without a parseable structured strength.
- Package `PA_ASSOCIATI` is compact display text and differs in granularity from the normalized relation. It remains a source attribute, never the canonical ingredient relation.
- 20,836 package rows have `PA_ASSOCIATI=N.D.`. API consumers must tolerate an empty/unknown ingredient list.
- Shortages contain 2 duplicate AIC keys and 2 duplicate full rows across 2,487 records. Shortage identity cannot be AIC alone; use AIC + start date + deterministic row fingerprint and suppress exact duplicate publication.
- The class A list has 123 AICs absent from the daily package snapshot; class H has 24. Their publication cadence and page/file dates are inconsistent.
- Class H’s original `Codice AIC` header includes an embedded newline and doubled whitespace. Header normalization must be quote-aware and collision-checked.
- Transparency headers embed the publication date in the public-price column, producing a schema-name change every month. Map it by stable semantic prefix and record the original header.

## LOW

- `TIPO_PROCEDURA` has 1 null and `FORNITURA` has 5 nulls in 159,858 package records.
- ATC descriptions are not unique (6,132 descriptions for 7,209 unique codes), as expected for a hierarchy; codes, not labels, are identities.
- Package form has 292 values and includes 10,722 `Non nota`; preserve raw form labels while normalizing opportunistically.
- Ingredient units contain 95 spellings/values. Canonical unit mapping must be versioned and retain raw units.
- Transparency has 7,228 null notes; this is optional descriptive content.
- Class H public price is absent on 31 rows, ex-factory price on 26, and maximum transfer price on 2,389.

## INFORMATIONAL

- No parser-level malformed rows were observed in any of the nine current CSVs when using semicolon delimiter, RFC4180 quotes, correct preamble and Windows-1252 decoding where needed.
- The 2025 shortage archive contains 100 complete-list XLSX snapshots. All 100 retain the same 13-column header; observed row counts range from 3,883 to 4,136 (3,896 on 2025-01-03; 4,107 on 2025-12-30).
- Package AIC is unique and non-null: 159,858 distinct values over 159,858 rows.
- `COD_FARMACO` groups 159,858 packages into 12,619 product-like records. `COD_CONFEZIONE` has only 990 values and is not globally unique.
- The package snapshot contains only `Autorizzata` (159,804) and `Sospesa` (54); it does not expose a distinct current commercialisation flag.
- Current package ATC codes all match the ATC artifact. The ATC file also includes parent/historical concepts not referenced by packages.
- The by-active-substance and by-name variants of each A/H class contain the same record set in a different order.

## Quality gates

Publication is rejected for missing/invalid canonical AIC, ambiguous header mapping, artifact hash mismatch, or an official group member without both group code and valid normalized AIC. Unknown strength/unit/form and an unresolved cross-snapshot package are recoverable warnings. Thresholds are configuration, recorded per ingestion run.
