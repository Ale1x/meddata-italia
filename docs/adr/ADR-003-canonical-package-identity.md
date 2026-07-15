# ADR-003: Canonical package identity

Status: Accepted — 2026-07-15

A package has an internal UUID; normalized nine-digit AIC is its external business key through a one-to-one marketing authorization. AIC remains text. Transparency values are left-padded because observed values are 7–8 digits; all other inspected sources use nine. `COD_CONFEZIONE` is rejected as global identity (only 990 values for 159,858 rows). `COD_FARMACO` identifies the product grouping.
