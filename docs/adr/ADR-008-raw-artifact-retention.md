# ADR-008: Raw artifact retention

Status: Accepted — 2026-07-15

Raw artifacts and discovery HTML are content-addressed, immutable and retained indefinitely by default. PostgreSQL stores hashes/metadata/object keys, not large bytes. Profiles, inferred schemas, samples and rejects use the prescribed MinIO prefixes. Lifecycle policies may tier old objects but must not overwrite or silently delete artifacts referenced by canonical provenance.
