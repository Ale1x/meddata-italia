# AIFA shortages dictionary

Granularity: a current shortage declaration/state row for a package and start date. Two preamble rows precede the header. 2,487 parsed rows, 2,485 AICs and two duplicate complete records.

| Original | Normalized | Type → canonical | Null / distinct | Target | Temporal / quality notes |
|---|---|---|---:|---|---|
| Nome medicinale | `nome_medicinale` | text | 0 / 1,576 | shortage observed product name | snapshot |
| Codice AIC | `codice_aic` | char(9) | 0 / 2,485 | package join | not episode-unique |
| Principio attivo | `principio_attivo` | text | 0 / 846 | shortage evidence | must not drive canonical equivalence |
| Forma farmaceutica e dosaggio | `forma_farmaceutica_e_dosaggio` | text | 0 / 2,315 | shortage description | composite, not reliably decomposed |
| Titolare AIC | `titolare_aic` | text | 0 / 295 | holder evidence | snapshot |
| Data inizio | `data_inizio` | `DD/MM/YYYY` → date | 0 / 736 | episode valid from | some future starts are present |
| Fine presunta | `fine_presunta` | date | 1,968 / 99 | expected end | absence means open/unknown, not ended |
| Equivalente | `equivalente` | yes/no | 0 / 2 | shortage evidence | 1,913 sì; never publish as official group membership |
| Motivazioni | `motivazioni` | text | 0 / 42 | shortage reason | includes permanent/temporary cessation |
| Suggerimenti/Indicazioni AIFA | `suggerimenti_indicazioni_aifa` | text | 0 / 19 | recommendation/evidence | import/alternative guidance |
| Nota AIFA | `nota_aifa` | text | 2,370 / 88 | shortage note | optional |
| Classe di rimborsabilità | `classe_di_rimborsabilita` | text | 0 / 4 | reimbursement observation | shortage-source value |
| Codice ATC | `codice_atc` | text | 2 / 733 | ATC evidence | optional |

The requested “actual end date” and an explicit current-status column are not present. Current/open state is inferred only from membership in the current list and dates, and must be labelled derived.

## 2025 history

The annual ZIP (`25bcc…d78`) contains 100 complete-list XLSX snapshots. Programmatic OOXML inspection found the same 13 headers in every snapshot, with 3,883–4,136 rows. The first inspected snapshot is 2025-01-03 (3,896 rows); the last is 2025-12-30 (4,107 rows). These are repeated state snapshots, not one append-only event log, reinforcing episode/fingerprint reconciliation.
