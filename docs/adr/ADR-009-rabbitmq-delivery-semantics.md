# ADR-009: RabbitMQ delivery semantics

Status: Accepted — 2026-07-15

Use a durable topic exchange/queue, persistent messages, publisher confirms, manual acknowledgments, bounded prefetch, retry queue and DLQ. Delivery is at least once. Consumers claim `event_id` in PostgreSQL before effects, while artifact/snapshot/business keys provide deeper idempotency. A message is acknowledged only after durable completion or durable retry/dead-letter routing.
