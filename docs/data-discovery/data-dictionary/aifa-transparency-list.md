# AIFA transparency list dictionary

Granularity: one official transparency-list membership per package/AIC in a monthly snapshot. 8,508 rows, 12 columns, no duplicate rows; AIC is unique after normalization. Authority: official equivalence membership and reference/public price observations.

| Original | Normalized | Type → canonical | Null / distinct | Key | Target | Temporal / quality notes |
|---|---|---|---:|---|---|---|
| Principio attivo | `principio_attivo` | text → display text | 0 / 374 | no | group source attributes | snapshot; not sufficient to infer equivalence |
| Confezione di riferimento | `confezione_di_riferimento` | text | 0 / 752 | no | group label/attributes | snapshot/versioned |
| ATC | `atc` | text → varchar(16) | 0 / 369 | join evidence | ATC classification | snapshot |
| AIC | `aic` | 7–8 digit text → char(9) | 0 / 8,508 | unique package key | marketing authorization/package | left-pad and retain original |
| Farmaco | `farmaco` | text | 0 / 3,684 | no | product observed name | correctable snapshot value |
| Confezione | `confezione` | text | 0 / 5,076 | no | package observed description | correctable snapshot value |
| Ditta | `ditta` | text | 0 / 336 | no | organization observed label | holder evidence; no organization source code |
| Prezzo riferimento SSN | `prezzo_riferimento_ssn` | locale money → numeric(12,4), EUR | 0 / 743 | no | price observation | monthly; comma decimal and `€` |
| Prezzo Pubblico 15 luglio 2026 | semantic `prezzo_pubblico` | locale money | 0 / 1,546 | no | price observation | header date changes each release |
| Differenza | `differenza` | locale money | 0 / 663 | no | source record/derived evidence | snapshot, AIFA-provided derivation |
| Nota | `nota` | text | 7,228 / 10 | no | membership/group attributes | optional snapshot text |
| Codice gruppo equivalenza | `codice_gruppo_equivalenza` | char(3) | 0 / 1,006 | group business key within authority | official equivalence group | observed stable across inspected snapshots |
