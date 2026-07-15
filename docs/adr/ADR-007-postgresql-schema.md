# ADR-007: PostgreSQL schema

Status: Accepted — 2026-07-15

Select the normalized schema (Alternative A) with generic JSONB raw/staging records. Observed 1:N ingredients, independent product codes, organization codes, temporal group membership/prices and cross-snapshot mismatches justify separate canonical relations. JSONB staging limits source-specific migration churn while preserving the RAW → STAGING → CANONICAL boundary.
