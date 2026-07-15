-- +goose Up
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE sources (
  id text PRIMARY KEY,
  name text NOT NULL,
  authority text NOT NULL,
  index_url text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  declared_frequency text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE source_discoveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text NOT NULL REFERENCES sources(id),
  observed_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL CHECK (status IN ('SUCCEEDED','FAILED')),
  index_url text NOT NULL,
  page_sha256 text CHECK (page_sha256 IS NULL OR page_sha256 ~ '^[0-9a-f]{64}$'),
  html_object_key text,
  http_status integer,
  http_headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  selected_url text,
  selected_link_text text,
  selected_format text,
  declared_size_bytes bigint,
  published_at timestamptz,
  error text
);
CREATE INDEX source_discoveries_latest_idx ON source_discoveries(source_id, observed_at DESC);

CREATE TABLE source_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text NOT NULL REFERENCES sources(id),
  discovery_id uuid REFERENCES source_discoveries(id),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  original_url text NOT NULL,
  object_key text NOT NULL,
  media_type text,
  extension text,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  http_headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_at timestamptz,
  downloaded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_id, sha256)
);

CREATE TABLE ingestion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text NOT NULL REFERENCES sources(id),
  artifact_id uuid REFERENCES source_artifacts(id),
  event_id uuid NOT NULL UNIQUE,
  correlation_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('REQUESTED','DISCOVERING','DOWNLOADING','PARSING','NORMALIZING','PUBLISHING','SUCCEEDED','UNCHANGED','FAILED')),
  force boolean NOT NULL DEFAULT false,
  discovery_only boolean NOT NULL DEFAULT false,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  records_seen bigint NOT NULL DEFAULT 0,
  records_staged bigint NOT NULL DEFAULT 0,
  records_rejected bigint NOT NULL DEFAULT 0,
  warnings bigint NOT NULL DEFAULT 0,
  error_code text,
  error text,
  transform_version text NOT NULL
);
CREATE INDEX ingestion_runs_latest_idx ON ingestion_runs(source_id, started_at DESC);

CREATE TABLE source_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id uuid NOT NULL REFERENCES source_artifacts(id),
  ingestion_run_id uuid NOT NULL REFERENCES ingestion_runs(id),
  parser_version text NOT NULL,
  schema_hash text NOT NULL,
  row_count bigint NOT NULL,
  rejected_count bigint NOT NULL DEFAULT 0,
  published_date date,
  observed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(artifact_id, parser_version)
);

CREATE TABLE source_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid NOT NULL REFERENCES source_snapshots(id),
  artifact_id uuid NOT NULL REFERENCES source_artifacts(id),
  ordinal bigint NOT NULL,
  source_record_key text,
  record_hash text NOT NULL CHECK (record_hash ~ '^[0-9a-f]{64}$'),
  raw jsonb NOT NULL,
  observed_at timestamptz NOT NULL,
  transform_version text NOT NULL,
  UNIQUE(artifact_id, ordinal),
  UNIQUE(artifact_id, source_record_key)
);
CREATE INDEX source_records_key_idx ON source_records(source_record_key);

CREATE TABLE staging_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid NOT NULL REFERENCES source_snapshots(id) ON DELETE CASCADE,
  source_record_id uuid NOT NULL UNIQUE REFERENCES source_records(id) ON DELETE CASCADE,
  source_id text NOT NULL REFERENCES sources(id),
  record_key text,
  payload jsonb NOT NULL,
  state text NOT NULL DEFAULT 'READY' CHECK (state IN ('READY','WARNING','REJECTED','PUBLISHED')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX staging_records_snapshot_idx ON staging_records(snapshot_id, state);

CREATE TABLE normalization_warnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingestion_run_id uuid NOT NULL REFERENCES ingestion_runs(id),
  source_record_id uuid REFERENCES source_records(id),
  severity text NOT NULL CHECK (severity IN ('BLOCKING','HIGH','MEDIUM','LOW','INFORMATIONAL')),
  code text NOT NULL,
  message text NOT NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX normalization_warnings_run_idx ON normalization_warnings(ingestion_run_id, severity);

CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  authority text NOT NULL,
  source_code text NOT NULL,
  name text NOT NULL,
  normalized_name text NOT NULL,
  source_record_id uuid REFERENCES source_records(id),
  observed_at timestamptz NOT NULL,
  UNIQUE(authority, source_code)
);

CREATE TABLE medicinal_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_namespace text NOT NULL DEFAULT 'AIFA',
  source_product_code text NOT NULL,
  name text NOT NULL,
  normalized_name text NOT NULL,
  source_record_id uuid REFERENCES source_records(id),
  observed_at timestamptz NOT NULL,
  UNIQUE(source_namespace, source_product_code)
);
CREATE INDEX medicinal_products_name_idx ON medicinal_products(normalized_name);

CREATE TABLE pharmaceutical_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  source_record_id uuid REFERENCES source_records(id)
);

CREATE TABLE administration_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  source_record_id uuid REFERENCES source_records(id)
);

CREATE TABLE marketing_authorizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aic char(9) NOT NULL UNIQUE CHECK (aic ~ '^[0-9]{9}$'),
  product_id uuid NOT NULL REFERENCES medicinal_products(id),
  holder_organization_id uuid REFERENCES organizations(id),
  administrative_status text,
  procedure_type text,
  source_record_id uuid REFERENCES source_records(id),
  observed_at timestamptz NOT NULL
);
CREATE INDEX marketing_authorizations_product_idx ON marketing_authorizations(product_id);

CREATE TABLE packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marketing_authorization_id uuid NOT NULL UNIQUE REFERENCES marketing_authorizations(id),
  product_id uuid NOT NULL REFERENCES medicinal_products(id),
  source_package_code text,
  description text NOT NULL,
  pharmaceutical_form_id uuid REFERENCES pharmaceutical_forms(id),
  administration_route_id uuid REFERENCES administration_routes(id),
  supply_regime text,
  compact_active_substances text,
  leaflet_url text,
  smpc_url text,
  source_record_id uuid REFERENCES source_records(id),
  observed_at timestamptz NOT NULL
);
CREATE INDEX packages_product_idx ON packages(product_id);

CREATE TABLE active_substances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  source_record_id uuid REFERENCES source_records(id),
  observed_at timestamptz NOT NULL
);

CREATE TABLE package_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES packages(id),
  active_substance_id uuid NOT NULL REFERENCES active_substances(id),
  ordinal integer NOT NULL CHECK (ordinal > 0),
  quantity numeric(18,6),
  unit_normalized text,
  quantity_raw text,
  unit_raw text,
  source_record_id uuid REFERENCES source_records(id),
  observed_at timestamptz NOT NULL,
  UNIQUE(package_id, ordinal)
);
CREATE INDEX package_ingredients_substance_idx ON package_ingredients(active_substance_id, package_id);

CREATE TABLE atc_classifications (
  code text PRIMARY KEY,
  description text NOT NULL,
  level smallint NOT NULL CHECK (level BETWEEN 1 AND 5),
  parent_code text REFERENCES atc_classifications(code),
  source_record_id uuid REFERENCES source_records(id),
  observed_at timestamptz NOT NULL
);

CREATE TABLE package_atc (
  package_id uuid NOT NULL REFERENCES packages(id),
  atc_code text NOT NULL REFERENCES atc_classifications(code),
  source_record_id uuid REFERENCES source_records(id),
  PRIMARY KEY(package_id, atc_code)
);
CREATE INDEX package_atc_code_idx ON package_atc(atc_code, package_id);

CREATE TABLE official_equivalence_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lineage_id uuid NOT NULL,
  authority text NOT NULL,
  relationship_type text NOT NULL CHECK (relationship_type = 'AIFA_TRANSPARENCY_OFFICIAL'),
  source_group_identifier text NOT NULL,
  source_group_label text NOT NULL,
  normalized_group_key text NOT NULL,
  member_fingerprint text NOT NULL,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_artifact_id uuid NOT NULL REFERENCES source_artifacts(id),
  published_date date,
  valid_from timestamptz NOT NULL,
  valid_to timestamptz,
  CHECK (valid_to IS NULL OR valid_to > valid_from),
  UNIQUE(authority, relationship_type, source_group_identifier, valid_from)
);
CREATE UNIQUE INDEX official_groups_open_idx ON official_equivalence_groups(authority, relationship_type, source_group_identifier) WHERE valid_to IS NULL;

CREATE TABLE official_equivalence_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES official_equivalence_groups(id),
  package_id uuid NOT NULL REFERENCES packages(id),
  source_record_id uuid NOT NULL REFERENCES source_records(id),
  valid_from timestamptz NOT NULL,
  valid_to timestamptz,
  CHECK (valid_to IS NULL OR valid_to > valid_from),
  UNIQUE(group_id, package_id, valid_from)
);
CREATE UNIQUE INDEX official_memberships_open_idx ON official_equivalence_memberships(group_id, package_id) WHERE valid_to IS NULL;
CREATE INDEX official_memberships_package_idx ON official_equivalence_memberships(package_id) WHERE valid_to IS NULL;

CREATE TABLE price_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES official_equivalence_groups(id),
  package_id uuid REFERENCES packages(id),
  kind text NOT NULL CHECK (kind IN ('REFERENCE_PRICE','PUBLIC_PRICE','EX_FACTORY_PRICE','MAX_TRANSFER_PRICE')),
  amount numeric(12,4) NOT NULL CHECK (amount >= 0),
  currency char(3) NOT NULL DEFAULT 'EUR',
  source_record_id uuid NOT NULL REFERENCES source_records(id),
  source_artifact_id uuid NOT NULL REFERENCES source_artifacts(id),
  published_date date,
  observed_at timestamptz NOT NULL,
  valid_from timestamptz,
  valid_to timestamptz,
  CHECK (group_id IS NOT NULL OR package_id IS NOT NULL)
);
CREATE INDEX price_observations_package_idx ON price_observations(package_id, observed_at DESC);

CREATE TABLE shortage_episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES packages(id),
  start_date date NOT NULL,
  expected_end_date date,
  actual_end_date date,
  reason text,
  equivalent_declared boolean,
  aifa_guidance text,
  aifa_note text,
  reimbursement_class text,
  row_fingerprint text NOT NULL,
  source_record_id uuid NOT NULL REFERENCES source_records(id),
  observed_at timestamptz NOT NULL,
  valid_to timestamptz,
  UNIQUE(package_id, start_date, row_fingerprint)
);
CREATE INDEX shortage_episodes_package_idx ON shortage_episodes(package_id, valid_to);

CREATE TABLE processed_events (
  event_id uuid PRIMARY KEY,
  event_type text NOT NULL,
  handler text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  result text NOT NULL
);

CREATE TABLE outbox_events (
  event_id uuid PRIMARY KEY,
  event_type text NOT NULL,
  event_version integer NOT NULL DEFAULT 1,
  correlation_id uuid NOT NULL,
  causation_id uuid,
  producer text NOT NULL,
  occurred_at timestamptz NOT NULL,
  payload jsonb NOT NULL,
  trace_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempt_count integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  published_at timestamptz,
  last_error text
);
CREATE INDEX outbox_pending_idx ON outbox_events(occurred_at) WHERE published_at IS NULL;

-- +goose Down
DROP TABLE IF EXISTS outbox_events, processed_events, shortage_episodes, price_observations,
  official_equivalence_memberships, official_equivalence_groups, package_atc, atc_classifications,
  package_ingredients, active_substances, packages, marketing_authorizations, administration_routes,
  pharmaceutical_forms, medicinal_products, organizations, normalization_warnings, staging_records,
  source_records, source_snapshots, ingestion_runs, source_artifacts, source_discoveries, sources CASCADE;
