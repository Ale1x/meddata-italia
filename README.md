# MedData Italia

Go/PostgreSQL MVP for versioned acquisition of public AIFA medicine data and unambiguous official-equivalence lookup.

The implemented vertical slice is:

```text
Kubernetes CronJob / local scheduler
  → RabbitMQ ingestion.requested
  → ingestion-worker discovery + download
  → immutable MinIO raw artifact and evidence
  → parsing/profile + PostgreSQL source records
  → staging JSONB
  → transactional canonical publication + outbox
  → public-api /api/v1/packages/by-aic/{aic}
  → /api/v1/packages/{id}/official-equivalents
```

Official equivalents come **only** from AIFA transparency-list co-membership (`AIFA_TRANSPARENCY_OFFICIAL`). Same ingredient, same ATC, class A/H groupings and shortage alternatives are never silently promoted to official substitutability.

## Data-discovery result

Discovery was executed on 2026-07-15 against current AIFA pages and artifacts. It profiled nine CSV variants (including A/H order variants), 526k+ current source rows, three historical transparency archives, all 100 complete-list XLSX snapshots in the 2025 shortage archive, candidate keys and six joins. Important observed facts:

- package AIC is unique over 159,858 rows and always nine-digit text;
- transparency AIC is 7–8 digits and must be left-padded for joins;
- package→ingredient is 1:N; all current package AICs have ingredient-source coverage;
- all 2,261 package ATC codes match the 7,209-code ATC register;
- current official list has 8,508 package memberships in 1,006 source groups;
- 99 official-list AICs do not match the independently updated daily package artifact and become warnings, not invented links;
- AIFA publishes CC BY 4.0 with attribution.

Start with [source-matrix.md](docs/data-discovery/source-matrix.md), [data-quality-report.md](docs/data-discovery/data-quality-report.md), [canonical-data-model.md](docs/architecture/canonical-data-model.md), and [equivalence-semantics.md](docs/architecture/equivalence-semantics.md). Machine-readable profiles and limited real samples are in `docs/data-discovery/generated/`.

## Prerequisites

- Go 1.26+
- Docker with Compose v2
- `sqlc` 1.31+ for regeneration
- Node/npm only for the optional OpenAPI lint target

## Run locally

```bash
docker compose up -d --build
```

Endpoints:

- Frontend demo: `http://localhost:3000`
- API: `http://localhost:8080`
- Swagger UI: `http://localhost:8080/docs`
- OpenAPI: `http://localhost:8080/openapi.yaml`
- RabbitMQ management: `http://localhost:15672` (`medicine` / `medicine`)
- MinIO console: `http://localhost:9001` (`minioadmin` / `minioadmin`)
- PostgreSQL: `localhost:5432` (`medicine` / `medicine`)

Seed sources in dependency order. Each command publishes an event and exits:

```bash
docker compose --profile tools run --rm ingestion-scheduler --source=aifa-atc
docker compose --profile tools run --rm ingestion-scheduler --source=aifa-packages
docker compose --profile tools run --rm ingestion-scheduler --source=aifa-package-ingredients
docker compose --profile tools run --rm ingestion-scheduler --source=aifa-transparency-list
docker compose --profile tools run --rm ingestion-scheduler --source=aifa-shortages
```

The second non-forced ingestion of the same source/hash ends as `UNCHANGED` before parsing/publication. Use `--force` only to replay a transform deliberately, or `--discovery-only` to preserve/index the page without downloading the artifact.

Lookup examples:

```bash
curl http://localhost:8080/api/v1/packages/by-aic/44155024
curl 'http://localhost:8080/api/v1/packages/by-aic/44155024?include=provenance'
curl 'http://localhost:8080/api/v1/official-equivalence/compare?left_aic=044155024&right_aic=039716182'
curl http://localhost:8080/api/v1/packages/REPLACE_UUID/official-equivalents
curl http://localhost:8080/api/v1/ingestions/latest
```

## Home Kubernetes deployment

The live demo uses the `kubernetes-admin@kubernetes` context:

- frontend: `https://health.passarelli.dev`, built with React/Tailwind/shadcn and served from the private `medicine-platform-frontend` R2 bucket by `medicine-platform-web`;
- API: `https://api.health.passarelli.dev`, exposed by the `medicine-platform-api-proxy` Worker through a Workers VPC Service and the `medicine-platform-home` Cloudflare Tunnel;
- runtime: CloudNativePG, RabbitMQ, MinIO, two public API replicas, one ingestion worker and the daily scheduler CronJob in namespace `medicine-platform`.

The Worker-to-cluster path is outbound-only; no home router port is exposed. Versioned manifests are under `deployments/kubernetes/home`, while the R2 and API proxy Workers are under `deployments/cloudflare`.

Public API requests under `/api/v1` are limited at the Cloudflare edge to 200 requests per 10 seconds per client (20 requests/second average). The browser frontend is subject to the same limit: `Origin` is intentionally not used as a trust boundary because non-browser clients can forge it. Interactive documentation is available at `https://api.health.passarelli.dev/docs`; the versioned contract is served at `https://api.health.passarelli.dev/openapi.yaml`.

Apply an existing installation after creating the referenced Kubernetes secrets:

```bash
kubectl apply -f deployments/kubernetes/home/00-infrastructure.yaml
kubectl apply -f deployments/kubernetes/home/10-applications.yaml
kubectl apply -f deployments/kubernetes/home/20-cloudflared.yaml
npx wrangler deploy --config deployments/cloudflare/wrangler.toml
npx wrangler deploy --config deployments/cloudflare/api-proxy/wrangler.toml
```

Public smoke tests:

```bash
curl https://api.health.passarelli.dev/health/ready
curl https://api.health.passarelli.dev/api/v1/packages/by-aic/026089019
curl 'https://api.health.passarelli.dev/api/v1/official-equivalence/compare?left_aic=044155024&right_aic=039716182'
```

## Verification

```bash
make sqlc
make fmt-check
make test
make frontend-test
make vet
make build
make openapi-lint
docker compose config --quiet
```

Default tests use local verified fixtures and never call AIFA. Docker-backed Testcontainers checks are opt-in:

```bash
make integration
```

An exhaustive, read-only catalog audit can be run against any populated PostgreSQL database. It scans every canonical package and checks AIC identity, product consistency, ingredient duplication, official-group ambiguity, temporal consistency and AIFA transparency-list provenance. It also reports how many packages follow each UI policy branch. The database URL is read from `MEDICINE_DATABASE_URL` and is never written to the report:

```bash
MEDICINE_DATABASE_URL='postgres://...' make catalog-audit
```

`make catalog-audit` fails on invariant violations. Use `make catalog-audit-strict` when warnings such as packages without normalized ingredients must also fail the run, and `go run ./cmd/catalog-audit --format=json` for CI artifacts.

## Configuration

Runtime environment variables use prefix `MEDICINE_`; see `internal/platform/config.go`. Source behavior is versioned in `configs/sources/*.yaml`. A static URL override is supported, but discovery rules and official index HTML remain first-class evidence.

MinIO layout:

```text
medicine-data/
  discovery/{source_id}/{timestamp}/index.html
  raw/{source_id}/{year}/{month}/{sha256}.{extension}
  profiles/{source_id}/{sha256}/profile.json
  schemas/{source_id}/{sha256}/inferred-schema.json
  samples/{source_id}/{sha256}/sample.jsonl
  rejected/{source_id}/{sha256}/rejected.jsonl
```

## Delivery and idempotency

RabbitMQ uses durable topic/DLX queues, persistent publications, publisher confirms, manual acknowledgements, bounded prefetch and three retries before DLQ. Idempotency is layered by event UUID, `(source, artifact SHA-256)`, artifact/record key, snapshot/parser version and canonical business keys. PostgreSQL advisory locks serialize one source; outbox rows are claimed using `FOR UPDATE SKIP LOCKED`.

## Known limits of this MVP

- The current AIFA package CSV has no structured administration route, commercialisation flag, reimbursement class or package price. The API omits rather than fabricates them.
- Substance identity is normalized label-based because no stable substance identifier is present.
- Raw/staging use in-memory CSV parsing before PostgreSQL `COPY`; streaming and bounded-memory profiling are the next scale hardening step for the 82 MB package artifact.
- The OTel provider is wired with W3C context and spans but no exporter; configure an OTLP exporter in the next operational increment.
- API keys, quotas and a separate cache are deliberately out of v1.

## Attribution

Source data: Agenzia Italiana del Farmaco (AIFA), licensed CC BY 4.0, verified 2026-07-15. AIFA data is provisional/descriptive where the official page states so. This project is not affiliated with AIFA and does not provide clinical advice.
