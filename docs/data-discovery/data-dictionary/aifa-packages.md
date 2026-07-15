# AIFA package register dictionary

Granularity: one currently published authorized/suspended package per AIC, observed daily. 159,858 rows, 15 columns, no duplicates. AIFA marks the data provisional and descriptive.

| Original | Normalized | Type → canonical | Null / distinct | Key | Target | Temporal / quality notes |
|---|---|---|---:|---|---|---|
| CODICE_AIC | `codice_aic` | char(9) text | 0 / 159,858 | unique | marketing authorization + package | stable external identifier, never numeric |
| COD_FARMACO | `cod_farmaco` | char(6) text | 0 / 12,619 | product grouping candidate | medicinal product | observed product-level code; validate longitudinally |
| COD_CONFEZIONE | `cod_confezione` | char(3) text | 0 / 990 | only with product | package source attribute | not globally unique |
| DENOMINAZIONE | `denominazione` | text | 0 / 10,526 | no | medicinal product name | correctable/versioned |
| DESCRIZIONE | `descrizione` | text | 0 / 66,571 | no | package description | correctable/versioned |
| CODICE_DITTA | `codice_ditta` | text | 0 / 862 | organization candidate | organization | snapshot holder identity |
| RAGIONE_SOCIALE | `ragione_sociale` | text | 0 / 862 | no | organization name | correctable/versioned |
| STATO_AMMINISTRATIVO | `stato_amministrativo` | enum-like text | 0 / 2 | no | authorization status | 159,804 authorized; 54 suspended |
| TIPO_PROCEDURA | `tipo_procedura` | enum-like text | 1 / 7 | no | marketing authorization procedure | snapshot |
| FORMA | `forma` | text | 0 / 292 | no | pharmaceutical form | raw retained; 10,722 `Non nota` |
| CODICE_ATC | `codice_atc` | text | 0 / 2,261 | FK candidate | package ATC | all match current ATC artifact |
| PA_ASSOCIATI | `pa_associati` | text | 0 / 3,930 | no | source package attribute | compact display only; 20,836 `N.D.` |
| FORNITURA | `fornitura` | text | 5 / 10 | no | supply regime | snapshot; no compact official code supplied |
| LINK_FI | `link_fi` | URL text | 0 / 12,619 | no | source document link | product-level repeated URL; do not crawl in pipeline |
| LINK_RCP | `link_rcp` | URL text | 0 / 12,619 | no | source document link | product-level repeated URL; do not crawl in pipeline |

No structured route, strength, price, reimbursement class, explicit marketing flag or unit-count column is present in this artifact.
