-- name: ClaimOutboxBatch :many
SELECT event_id, event_type, event_version, correlation_id, causation_id, producer, occurred_at, payload, trace_context, attempt_count
FROM outbox_events WHERE published_at IS NULL ORDER BY occurred_at
FOR UPDATE SKIP LOCKED LIMIT $1;

-- name: MarkOutboxPublished :exec
UPDATE outbox_events SET published_at=now(), attempt_count=attempt_count+1, last_attempt_at=now(), last_error=NULL WHERE event_id=$1;

-- name: MarkOutboxFailed :exec
UPDATE outbox_events SET attempt_count=attempt_count+1, last_attempt_at=now(), last_error=$2 WHERE event_id=$1;
