-- +goose Up
ALTER TABLE source_records
  DROP CONSTRAINT source_records_artifact_id_ordinal_key,
  DROP CONSTRAINT source_records_artifact_id_source_record_key_key;

ALTER TABLE source_records
  ADD CONSTRAINT source_records_snapshot_id_ordinal_key UNIQUE (snapshot_id, ordinal),
  ADD CONSTRAINT source_records_snapshot_id_source_record_key_key UNIQUE (snapshot_id, source_record_key);

-- +goose Down
ALTER TABLE source_records
  DROP CONSTRAINT source_records_snapshot_id_ordinal_key,
  DROP CONSTRAINT source_records_snapshot_id_source_record_key_key;

ALTER TABLE source_records
  ADD CONSTRAINT source_records_artifact_id_ordinal_key UNIQUE (artifact_id, ordinal),
  ADD CONSTRAINT source_records_artifact_id_source_record_key_key UNIQUE (artifact_id, source_record_key);
