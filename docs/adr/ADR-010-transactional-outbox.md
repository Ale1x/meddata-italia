# ADR-010: Transactional outbox

Status: Accepted — 2026-07-15

Canonical publication and its domain events commit in one PostgreSQL transaction. Independent outbox publishers claim batches with `FOR UPDATE SKIP LOCKED`, publish with RabbitMQ confirms, then set `published_at`; failures increment attempts and retain error/time. Duplicate publication after a crash is tolerated through event-id idempotency. No distributed transaction is introduced.
