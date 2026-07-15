# PostgreSQL schema proposal

## Alternatives

### Alternative A — normalized temporal catalog (selected)

Separate product, authorization, package, organization, substance/ingredient, form, ATC, official group/membership, prices and shortages. Immutable provenance and staging sit beside current projections and temporal relations.

Benefits: enforces official-equivalence semantics in SQL, supports holder/status/membership changes, clean package API joins, exact provenance and future sources. Costs: more tables, reconciliation logic and transactional publication. The observed 1:N ingredient relation, 12,619:159,858 product/package ratio, temporal prices, 1,006 groups, and snapshot mismatches justify this cost.

### Alternative B — MVP package document

One `packages` table with JSONB ingredients/ATC/holder plus `equivalence_groups` and memberships. Benefits: fewer joins and faster first import. Costs: duplicated organizations/substances, hard temporal diffs, weak constraints, whole-document rewrites, difficult provenance and future multi-source reconciliation. It also hides the independently observed product code and N:M-ready concepts.

Alternative A is selected, with one simplification: raw and staging records use generic JSONB tables keyed by artifact rather than one physical staging table per source. Parsers still cannot write canonical tables; publication reads the staged snapshot in a separate transaction phase.

## Table responsibilities

| Table | Granularity / origin | PK and business keys | Important constraints/indexes | Temporal/provenance / consumers |
|---|---|---|---|---|
| `sources` | configured AIFA dataset | text `id` | enabled, authority | discovery, ops API; retain indefinitely |
| `source_discoveries` | one index fetch | UUID; source + observed time | status check, page hash | HTML object key, HTTP metadata; retain indefinitely |
| `source_artifacts` | immutable downloaded bytes | UUID; unique(source, sha256) | 64-hex hash, object key | URL/published/downloaded metadata; all critical APIs |
| `ingestion_runs` | processing attempt | UUID; event id unique | state check; source/start index | operational history; retain >= 2 years |
| `source_snapshots` | parsed artifact dataset | UUID; unique(artifact, parser version) | row counts/schema hash | observed/published dates; indefinite |
| `source_records` | source row | UUID; unique(artifact, ordinal), record hash | JSONB GIN optional | immutable raw record and transformation version |
| `staging_records` | normalized-but-source-shaped row | UUID; unique(snapshot, source record) | state/checks | JSONB payload, errors; purge/rebuild after retention window |
| `normalization_warnings` | warning per run/record | UUID | severity/code indexes | source record/run; audit |
| `medicinal_products` | AIFA `COD_FARMACO` | UUID; unique(source namespace, source product code) | name search index | current projection + provenance record; medicine API |
| `organizations` | AIFA `CODICE_DITTA` | UUID; unique(authority, source code) | normalized name index | current projection; package API |
| `marketing_authorizations` | one AIC | UUID; unique `aic` | regex `^[0-9]{9}$`, product/holder indexes | status/holder observed dates and record |
| `pharmaceutical_forms` | normalized form | UUID; unique normalized name | raw labels remain in records | package detail |
| `administration_routes` | normalized route | UUID | not populated from current sources | future |
| `packages` | one authorized presentation | UUID; unique authorization id | product/form indexes | source package code, current description, record; package API |
| `active_substances` | normalized label | UUID; unique normalized name | trigram optional later | current identity + record |
| `package_ingredients` | component row | UUID; unique(package, ordinal) | substance index | raw quantity/unit, numeric strength if valid, record |
| `atc_classifications` | ATC concept | code text PK | parent index, level check | observed record; ATC API |
| `package_atc` | package/classification | composite PK | ATC/package reverse indexes | source record |
| `official_equivalence_groups` | temporal group version | UUID; unique(authority,type,source id,valid_from) | type check, open-version partial index | label, key, fingerprint, artifact, validity; equivalents API |
| `official_equivalence_memberships` | temporal package membership | UUID; unique(group,package,valid_from) | nonempty validity, package/current indexes | source record, validity; equivalents API |
| `price_observations` | group/package price at publication | UUID | kind/currency/amount checks | artifact/record, dates; package/equivalence API |
| `shortage_episodes` | package/start/fingerprint | UUID; unique(package,start,fingerprint) | open episode/package index | expected/actual end, source text/evidence; shortage API |
| `processed_events` | consumed event id | UUID event id | handler/result | event idempotency; retain >= message replay horizon |
| `outbox_events` | event in publishing transaction | UUID event id | partial `(published_at is null)`, attempts | `FOR UPDATE SKIP LOCKED`; retain published 30–90 days |
| `advisory_locks` | no table | PostgreSQL advisory lock key | source-specific hash | coordinates ingestion/publication |

UUIDs are API identities; business keys remain constrained. Money uses `numeric(12,4)` plus ISO currency. All timestamps are `timestamptz`; civil publication dates are `date`. Open temporal rows have `valid_to IS NULL`. Canonical rows never cascade-delete provenance.
