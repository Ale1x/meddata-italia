# Canonical data model

This model follows the inspected records, not names alone. The selected v1 is normalized around package identity and preserves source observations separately from canonical current projections.

| Concept | Independent identity and evidence | Cardinality / temporal semantics | MVP use |
|---|---|---|---|
| MedicinalProduct | AIFA `COD_FARMACO` (12,619 observed), with name | one product has many packages; attributes are snapshot-correctable | lookup/detail |
| Package | AIFA package row, externally identified through AIC authorization | one per observed AIC in package source; description/form/supply are versioned observations | primary API resource |
| MarketingAuthorization | AIC is the verified external business key and applies to a package presentation | one authorization to one package in the observed source; status/holder may change | AIC lookup |
| ActiveSubstance | normalized source label plus stable UUID; raw label retained | N:M with package through ingredient; identity reconciliation is correctable | package detail/filter |
| PackageIngredient | source component row/order | package 1:N; observed per source snapshot | package detail |
| Strength | quantity + raw/normalized unit attached to ingredient | optional; 46% quantity and 39% unit are null-equivalent | package detail when supported |
| PharmaceuticalForm | normalized label identity, source raw label | package N:1; 292 values, including unknown | package detail |
| AdministrationRoute | independent terminology placeholder | no structured route field observed; no canonical row fabricated in v1 | future |
| Organization | AIFA company code (862 observed) and name | holder may change over time | package detail |
| ATCClassification | AIFA `CODICE_ATC`, including hierarchy levels | package N:M-capable even though one code is present in current package CSV | API lookup |
| OfficialEquivalenceGroup | authority + source group identifier (`Codice gruppo equivalenza`) | snapshot-versioned identity; label/attributes and validity can change | official equivalents |
| OfficialEquivalenceMembership | group + package + validity | N:M over time; current snapshot has one group per listed AIC | official equivalents |
| PriceObservation | type, amount, currency, observed/published/valid dates | multiple temporal observations per group/package | reference/public prices |
| ShortageEpisode | AIC + start date + row fingerprint | repeated/updated episode snapshots; expected end optional | future/API scaffold |
| Source | stable configured dataset identity | long-lived | discovery/ops |
| SourceArtifact | immutable bytes identified by source + SHA-256 | many versions per source | provenance/idempotency |
| SourceSnapshot | parsed semantic view of an artifact | one or more datasets in an artifact; observed/published dates | provenance |
| SourceRecord | artifact + ordinal + raw JSON + record key/hash | immutable; retains rejected and normalized records | audit/replay |
| IngestionRun | processing attempt and state machine | multiple attempts may reference one unchanged artifact | operations |
| NormalizationWarning | severity/code/record/context | append-only audit, blocking flag | quality |

## Identity decisions

- AIC is stored as canonical 9-digit **text**, never integer. `source_value` is retained because transparency removes leading zeroes.
- `COD_FARMACO` is used as the AIFA product business key, while UUIDs insulate APIs from a future source correction or additional source.
- Package and marketing authorization remain separate concepts despite the observed 1:1 relation: AIC state/holder/procedure belongs to authorization, physical presentation/form/description belongs to package.
- Active-substance label matching is normalization, not a globally authoritative substance identifier. The transformation version and raw label are mandatory.
- Administration route is modeled but not populated because no inspected CSV provides a structured route.

## Temporal policy

Immutable source artifacts/records are append-only. Correctable catalog entities have stable UUIDs and current projections. State-changing relationships (authorization holder/status, official group and membership, prices, shortage episode observations) use `valid_from`, `valid_to`, `observed_at`, and a source artifact reference. Publication closes prior open intervals only within the same authority/source scope.

## Provenance invariant

Every canonical observation points to `source_record`, which points to `source_artifact`, `source_snapshot`, and the successful `ingestion_run`. Artifact carries hash, URL, HTTP metadata, discovery evidence and timestamps. Transform version is stored on snapshot/run/record so a replay is explainable.
