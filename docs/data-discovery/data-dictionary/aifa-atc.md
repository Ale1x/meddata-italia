# AIFA ATC dictionary

Granularity: one ATC concept at any published hierarchy level. 7,209 unique, non-null codes; 6,132 distinct descriptions.

| Original | Normalized | Type → canonical | Null / distinct | Key | Target | Temporal / quality notes |
|---|---|---|---:|---|---|---|
| CODICE_ATC | `codice_atc` | text/varchar(16) | 0 / 7,209 | unique | ATC classification | includes parent and fifth-level codes |
| DESCRIZIONE | `descrizione` | text | 0 / 6,132 | no | ATC description | labels are not identities; may be corrected |

Hierarchy level is derived from code shape and marked derived; the original code and source record remain authoritative.
