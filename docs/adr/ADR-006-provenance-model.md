# ADR-006: Provenance model

Status: Accepted — 2026-07-15

Canonical observations reference the precise source record; records reference snapshot, artifact and run. Artifact stores SHA-256, object key, original URL, HTTP metadata, published/downloaded timestamps and discovery. Transform version is recorded. This longer chain is chosen over a single `source_url` because audit, replay and corrected normalization are product requirements.
