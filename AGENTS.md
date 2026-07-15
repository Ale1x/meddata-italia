# Repository guidance

- Preserve the semantic boundary: only `AIFA_TRANSPARENCY_OFFICIAL` may feed public official-equivalent responses.
- Never store AIC as a number. Preserve the source value and normalize to nine digits at the canonical boundary.
- Parsers write immutable raw/source records and staging first; canonical writes occur only in the publication transaction.
- Generated files under `db/generated` come from `sqlc generate`; do not hand-edit them.
- Tests and default builds must not require the network. Full AIFA files are not committed; verified limited fixtures live under `testdata/aifa`.
- Run `make fmt-check test vet build` after changes that affect Go code or SQL.
