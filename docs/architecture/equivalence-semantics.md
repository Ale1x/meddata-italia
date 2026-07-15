# Equivalence semantics

| Type | Meaning | v1 public official-equivalents? |
|---|---|---|
| `AIFA_TRANSPARENCY_OFFICIAL` | Same `Codice gruppo equivalenza` in an AIFA transparency-list snapshot | **yes, exclusively** |
| `AIFA_SHORTAGE_DECLARED_ALTERNATIVE` | Shortage artifact says an equivalent/alternative exists or provides guidance | no; evidence on shortage only |
| `SAME_ACTIVE_SUBSTANCE` | Normalized ingredient overlap/equality | no; searchable evidence only |
| `SAME_ATC` | Shared ATC code | no |
| `THERAPEUTIC_ALTERNATIVE` | Authority/curated therapeutic alternative | no, future evidence |
| `MANUAL` | Operator-curated relationship | no, future |
| `INFERRED` | Algorithmic relationship | no, future and explicitly labelled |

The API handler and SQL query hard-code `AIFA_TRANSPARENCY_OFFICIAL`; no fallback to substance, ATC, class A/H grouping, or shortage declarations is allowed.

## Official group lifecycle

The inspected transparency CSV provides a non-null three-character group code (1,006 current groups), original reference-package label, active-substance label, ATC, and prices. The primary business key is `(authority='AIFA', relationship_type='AIFA_TRANSPARENCY_OFFICIAL', source_group_identifier)`.

Each publication records source label, normalized key, member-set fingerprint, artifact, publication date, validity interval, group attributes, membership intervals and reference-price observation. A code retained across inspected snapshots retained its members’ group assignment; however code reuse is not assumed indefinitely.

Reconciliation:

1. Match by AIFA source group code within the same authority/type.
2. Compare normalized label, ATC and sorted normalized-member-AIC fingerprint.
3. If compatible, close prior version and open the new version under the stable canonical group UUID.
4. If code exists but both semantic attributes and member overlap materially conflict, emit `GROUP_CODE_REUSE` HIGH warning and create a new lineage version pending review.
5. If a future source omits group code, compute `sha256(authority|type|normalized-label|sorted-members)` as a snapshot fingerprint only; reconcile with weighted label/member overlap and never claim cross-snapshot identity automatically.

Membership for an AIC absent from the compatible package snapshot remains an unresolved authoritative source record and warning. It becomes API-visible only after a real package can be linked; it is never reassigned by inference.
