# ADR-005: Temporal modeling

Status: Accepted — 2026-07-15

Raw artifacts/records are immutable snapshots. Canonical identities are stable UUIDs; changing group memberships, prices and shortage episodes carry validity and observation time. Publication closes open intervals within one source/authority scope. This captures monthly group/price changes and daily provisional package state without full event sourcing.
