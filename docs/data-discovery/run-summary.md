# Data-discovery gate summary — 2026-07-15

1. **Datasets analysed:** transparency current + 3 historical snapshots; package register; package ingredients; ATC; complete shortages current + all 100 complete-list snapshots in the 2025 annual archive; class A/H in both orderings; Open Data licensing page; medicine portal manually scoped.
2. **Files:** nine current CSVs, three transparency-history ZIPs and the 88 MB shortage archive 2025. Exact URLs, bytes and hashes are in `source-matrix.md`.
3. **Real columns:** 12 transparency, 15 packages, 4 ingredients, 2 ATC, 13 shortages, 10 class A and 10 class H. Per-column metrics are in dictionaries and generated profiles.
4. **Observed keys:** package AIC unique; transparency normalized AIC unique; A/H AIC unique; ATC code unique; shortage AIC non-unique; ingredient AIC repeats.
5. **Relations:** package→ingredient 1:N; package→ATC N:1; official membership→package 1:1 on 98.836% matched keys; product code→packages 1:N.
6. **Problems:** AIC leading-zero loss, independent snapshot mismatch, ingredient scope mismatch, `N.D.`/missing strengths, dynamic headers, class-H header newline, duplicate shortage rows, page/file date inconsistencies.
7. **Model:** normalized identities plus immutable provenance, temporal official groups/memberships/prices and current catalog projections.
8. **Schema selected:** normalized Alternative A with generic JSONB source/staging records.
9. **Equivalence:** public v1 exclusively `AIFA_TRANSPARENCY_OFFICIAL` using the observed three-character source group code and versioned membership.
10. **Open assumptions:** longitudinal stability of `COD_FARMACO`; future group-code reuse; substance-label reconciliation; absence of structured administration route; exact commercialisation semantics. None blocks the vertical slice.

Gate decision: **PASS**. Files were accessible, structure and keys were sufficiently determinable, and residual assumptions do not require inferred equivalence.
