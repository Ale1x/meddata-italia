-- name: GetPackageByAIC :one
SELECT p.id, ma.aic, mp.id AS medicine_id, mp.name, p.description,
       pf.id AS form_id, pf.display_name AS form_name,
       ar.id AS route_id, ar.display_name AS route_name,
       o.id AS holder_id, o.name AS holder_name,
       ma.administrative_status, p.supply_regime, p.observed_at,
       sa.sha256 AS artifact_hash, s.id AS source_id, sa.published_at, sa.downloaded_at
FROM packages p
JOIN marketing_authorizations ma ON ma.id = p.marketing_authorization_id
JOIN medicinal_products mp ON mp.id = p.product_id
LEFT JOIN pharmaceutical_forms pf ON pf.id = p.pharmaceutical_form_id
LEFT JOIN administration_routes ar ON ar.id = p.administration_route_id
LEFT JOIN organizations o ON o.id = ma.holder_organization_id
LEFT JOIN source_records sr ON sr.id = p.source_record_id
LEFT JOIN source_artifacts sa ON sa.id = sr.artifact_id
LEFT JOIN sources s ON s.id = sa.source_id
WHERE ma.aic = $1;

-- name: GetPackageByID :one
SELECT p.id, ma.aic, mp.id AS medicine_id, mp.name, p.description,
       pf.id AS form_id, pf.display_name AS form_name,
       ar.id AS route_id, ar.display_name AS route_name,
       o.id AS holder_id, o.name AS holder_name,
       ma.administrative_status, p.supply_regime, p.observed_at,
       sa.sha256 AS artifact_hash, s.id AS source_id, sa.published_at, sa.downloaded_at
FROM packages p
JOIN marketing_authorizations ma ON ma.id = p.marketing_authorization_id
JOIN medicinal_products mp ON mp.id = p.product_id
LEFT JOIN pharmaceutical_forms pf ON pf.id = p.pharmaceutical_form_id
LEFT JOIN administration_routes ar ON ar.id = p.administration_route_id
LEFT JOIN organizations o ON o.id = ma.holder_organization_id
LEFT JOIN source_records sr ON sr.id = p.source_record_id
LEFT JOIN source_artifacts sa ON sa.id = sr.artifact_id
LEFT JOIN sources s ON s.id = sa.source_id
WHERE p.id = $1;

-- name: ListPackageIngredients :many
SELECT ps.id, ps.display_name, pi.quantity, pi.unit_normalized, pi.quantity_raw, pi.unit_raw
FROM package_ingredients pi
JOIN active_substances ps ON ps.id = pi.active_substance_id
WHERE pi.package_id = $1
ORDER BY pi.ordinal;

-- name: ListPackageATC :many
SELECT a.code, a.description, a.level
FROM package_atc pa JOIN atc_classifications a ON a.code = pa.atc_code
WHERE pa.package_id = $1 ORDER BY a.code;

-- name: GetOfficialGroupForPackage :one
SELECT g.id, g.authority, g.source_group_identifier, g.source_group_label,
       g.published_date, g.valid_from, g.valid_to, sa.sha256 AS artifact_hash, s.id AS source_id
FROM official_equivalence_memberships m
JOIN official_equivalence_groups g ON g.id = m.group_id
JOIN source_artifacts sa ON sa.id = g.source_artifact_id
JOIN sources s ON s.id = sa.source_id
WHERE m.package_id = $1 AND m.valid_to IS NULL AND g.valid_to IS NULL
  AND g.relationship_type = 'AIFA_TRANSPARENCY_OFFICIAL';

-- name: ListOfficialEquivalents :many
SELECT p.id, ma.aic, mp.name, p.description, m.valid_from AS membership_valid_from,
       m.valid_to AS membership_valid_to
FROM official_equivalence_memberships own
JOIN official_equivalence_groups g ON g.id = own.group_id
JOIN official_equivalence_memberships m ON m.group_id = g.id AND m.valid_to IS NULL
JOIN packages p ON p.id = m.package_id
JOIN marketing_authorizations ma ON ma.id = p.marketing_authorization_id
JOIN medicinal_products mp ON mp.id = p.product_id
WHERE own.package_id = $1 AND own.valid_to IS NULL AND g.valid_to IS NULL
  AND g.relationship_type = 'AIFA_TRANSPARENCY_OFFICIAL' AND p.id <> $1
ORDER BY mp.name, ma.aic;

-- name: ListGroupPrices :many
SELECT kind, amount, currency, published_date, observed_at, valid_from, valid_to
FROM price_observations WHERE group_id = $1 ORDER BY observed_at DESC, kind;

-- name: ListMedicines :many
SELECT id, source_product_code, name, observed_at
FROM medicinal_products
WHERE ($1::text = '' OR normalized_name LIKE '%' || lower($1) || '%')
ORDER BY name LIMIT $2 OFFSET $3;

-- name: GetMedicine :one
SELECT id, source_product_code, name, observed_at FROM medicinal_products WHERE id = $1;

-- name: ListPackagesByMedicine :many
SELECT p.id, ma.aic, p.description, p.observed_at
FROM packages p JOIN marketing_authorizations ma ON ma.id=p.marketing_authorization_id
WHERE p.product_id=$1 ORDER BY ma.aic;

-- name: ListActiveSubstances :many
SELECT id, display_name, observed_at FROM active_substances ORDER BY display_name LIMIT $1 OFFSET $2;

-- name: GetActiveSubstance :one
SELECT id, display_name, observed_at FROM active_substances WHERE id = $1;

-- name: ListPackagesByActiveSubstance :many
SELECT p.id, ma.aic, mp.name, p.description, p.observed_at,
       pi.quantity, pi.unit_normalized, pi.quantity_raw, pi.unit_raw,
       pf.display_name AS pharmaceutical_form,
       ar.display_name AS administration_route,
       p.supply_regime,
       ma.administrative_status,
       o.name AS authorization_holder,
       (SELECT COUNT(DISTINCT all_pi.active_substance_id) FROM package_ingredients all_pi WHERE all_pi.package_id = p.id) AS ingredient_count,
       EXISTS (
         SELECT 1
         FROM official_equivalence_memberships oem
         JOIN official_equivalence_groups oeg ON oeg.id = oem.group_id
         WHERE oem.package_id = p.id
           AND oem.valid_to IS NULL
           AND oeg.valid_to IS NULL
           AND oeg.relationship_type = 'AIFA_TRANSPARENCY_OFFICIAL'
       ) AS in_official_list
FROM package_ingredients pi JOIN packages p ON p.id=pi.package_id
JOIN marketing_authorizations ma ON ma.id=p.marketing_authorization_id
JOIN medicinal_products mp ON mp.id=p.product_id
LEFT JOIN pharmaceutical_forms pf ON pf.id=p.pharmaceutical_form_id
LEFT JOIN administration_routes ar ON ar.id=p.administration_route_id
LEFT JOIN organizations o ON o.id=ma.holder_organization_id
WHERE pi.active_substance_id=$1 ORDER BY mp.name,ma.aic LIMIT $2 OFFSET $3;

-- name: GetATC :one
SELECT code, description, level, parent_code FROM atc_classifications WHERE code = $1;

-- name: ListLatestIngestions :many
SELECT DISTINCT ON (source_id) id, source_id, artifact_id, status, started_at, finished_at,
       records_seen, records_staged, records_rejected, warnings, error_code, error
FROM ingestion_runs ORDER BY source_id, started_at DESC;

-- name: ListShortages :many
SELECT se.id,p.id AS package_id,ma.aic,mp.name,se.start_date,se.expected_end_date,se.actual_end_date,
       se.reason,se.equivalent_declared,se.aifa_guidance,se.aifa_note,se.observed_at
FROM shortage_episodes se JOIN packages p ON p.id=se.package_id
JOIN marketing_authorizations ma ON ma.id=p.marketing_authorization_id
JOIN medicinal_products mp ON mp.id=p.product_id
WHERE se.valid_to IS NULL ORDER BY se.start_date DESC LIMIT $1 OFFSET $2;

-- name: ListPackageShortages :many
SELECT se.id,se.start_date,se.expected_end_date,se.actual_end_date,se.reason,se.equivalent_declared,
       se.aifa_guidance,se.aifa_note,se.observed_at
FROM shortage_episodes se WHERE se.package_id=$1 ORDER BY se.start_date DESC;

-- name: ListSources :many
SELECT id, name, authority, index_url, enabled, declared_frequency, updated_at FROM sources ORDER BY id;

-- name: IsReady :one
SELECT EXISTS (SELECT 1 FROM sources) AS ready;
