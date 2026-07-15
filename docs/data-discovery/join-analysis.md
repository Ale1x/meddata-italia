# Join analysis

All AIC joins retain the original value and use `digits-only → left-pad to 9`. ATC joins use trim + uppercase. Metrics are distinct-key metrics from the 2026-07-15 acquisition.

| Join | Observed cardinality | Common | Missing left | Missing right | Left match | Decision |
|---|---|---:|---:|---:|---:|---|
| packages.`CODICE_AIC` → ingredients.`CODICE_AIC` | 1:N (24,391 ingredient AICs have multiple rows) | 159,858 | 0 | 139,441 | 100% | publish ingredients only for package keys in the compatible package snapshot; retain all other source records |
| packages.`CODICE_ATC` → ATC.`CODICE_ATC` | N:1 | 2,261 | 0 | 4,948 | 100% | FK is safe for a compatible snapshot; ATC contains unused hierarchy nodes |
| transparency.`AIC` → packages.`CODICE_AIC` | 1:1 on matched keys | 8,409 | 99 | 151,449 | 98.836% | official memberships remain authoritative; unresolved package links emit HIGH warnings |
| shortages.`Codice AIC` → packages.`CODICE_AIC` | N:1 due two duplicate keys | 2,485 | 0 | 157,373 | 100% | package join valid; shortage identity includes episode/fingerprint |
| class A.`AIC` → packages.`CODICE_AIC` | 1:1 | 10,494 | 123 | 149,364 | 98.841% | classification evidence only, not official equivalence |
| class H.`Codice  AIC` → packages.`CODICE_AIC` | 1:1 | 2,383 | 24 | 157,475 | 99.003% | classification evidence only, not official equivalence |

Representative unmatched transparency AICs after normalization: `022803074`, `023183193`, `023401021`, `025298050`, `026664096`. These are not parser failures: the same pattern appears in A/H lists and is consistent with source timing/scope differences.

## Snapshot comparison

The comparison key is normalized AIC. “Modified” is a whole-row comparison; header changes are driven primarily by the dated public-price column.

| From → to | Added | Removed | Modified | Unchanged | Groups added/removed | Membership group changes for retained AIC |
|---|---:|---:|---:|---:|---:|---:|
| 2025-01-15 → 2026-03-16 | 557 | 350 | 725 | 7,131 | 39 / 15 | 0 |
| 2026-03-16 → 2026-04-15 | 51 | 11 | 24 | 8,378 | 3 / 1 | 0 |
| 2026-04-15 → 2026-07-15 | 137 | 82 | 136 | 8,235 | 9 / 3 | 0 |

`Codice gruppo equivalenza` is present, non-null, three characters, and observed as a stable source identifier for retained members in these snapshots. This removes the need to use a fingerprint as the primary group identity in v1. A fingerprint of sorted normalized member AICs + label is still stored as reconciliation evidence and protects against future code reuse.
