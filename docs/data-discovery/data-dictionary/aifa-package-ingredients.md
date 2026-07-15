# AIFA package ingredients dictionary

Granularity: active-substance component per package in a daily snapshot. 337,651 rows over 299,299 AICs; up to 30 observed rows per AIC. The relation covers every AIC in the package artifact but also 139,441 AICs outside it.

| Original | Normalized | Type → canonical | Null / distinct | Key | Target | Temporal / quality notes |
|---|---|---|---:|---|---|---|
| CODICE_AIC | `codice_aic` | char(9) text | 0 / 299,299 | join component | package ingredient | 24,391 duplicated keys express 1:N |
| PRINCIPIO_ATTIVO | `principio_attivo` | text | 0 / 5,732 | substance natural-key candidate | active substance | 52,926 rows are `N.D.`; normalized label identity is provisional |
| QUANTITA | `quantita` | locale/decimal text → numeric when valid | 156,331 / 1,967 | no | strength numerator | `0.0` common; raw value always retained |
| UNITA_MISURA | `unita_misura` | text → normalized unit when mapped | 133,262 / 95 | no | strength unit | includes `N.D.` and heterogeneous labels |
