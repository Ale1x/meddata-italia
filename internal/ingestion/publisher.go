package ingestion

import (
	"context"
	"fmt"
	"github.com/example/medicine-platform/internal/messaging"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"time"
)

func publishCanonical(ctx context.Context, tx pgx.Tx, sourceID string, snapshotID, artifactID, runID uuid.UUID, event messaging.Envelope, observed time.Time) error {
	var sql string
	args := []any{pgx.QueryExecModeSimpleProtocol, snapshotID, observed}
	switch sourceID {
	case "aifa-packages":
		sql = publishPackagesSQL
	case "aifa-package-ingredients":
		sql = publishIngredientsSQL
	case "aifa-atc":
		sql = publishATCSQL
	case "aifa-transparency-list":
		sql = publishTransparencySQL
		args = []any{pgx.QueryExecModeSimpleProtocol, snapshotID, artifactID, observed}
	case "aifa-shortages":
		sql = publishShortagesSQL
	default:
		sql = "UPDATE staging_records SET state='PUBLISHED' WHERE snapshot_id=$1"
		args = []any{pgx.QueryExecModeSimpleProtocol, snapshotID}
	}
	if _, err := tx.Exec(ctx, sql, args...); err != nil {
		return err
	}
	payload := fmt.Sprintf(`{"source_id":%q,"ingestion_run_id":%q,"artifact_id":%q}`, sourceID, runID, artifactID)
	outID := uuid.New()
	_, err := tx.Exec(ctx, `INSERT INTO outbox_events(event_id,event_type,event_version,correlation_id,causation_id,producer,occurred_at,payload) VALUES($1,'catalog.updated',1,$2,$3,'ingestion-worker',now(),$4::jsonb)`, outID, event.CorrelationID, event.EventID, payload)
	return err
}

const publishPackagesSQL = `
INSERT INTO organizations(authority,source_code,name,normalized_name,source_record_id,observed_at)
SELECT 'AIFA',payload->>'codice_ditta',max(payload->>'ragione_sociale'),lower(max(payload->>'ragione_sociale')),max(source_record_id::text)::uuid,$2 FROM staging_records WHERE snapshot_id=$1 GROUP BY payload->>'codice_ditta'
ON CONFLICT(authority,source_code) DO UPDATE SET name=EXCLUDED.name,normalized_name=EXCLUDED.normalized_name,source_record_id=EXCLUDED.source_record_id,observed_at=EXCLUDED.observed_at;
INSERT INTO medicinal_products(source_namespace,source_product_code,name,normalized_name,source_record_id,observed_at)
SELECT 'AIFA',payload->>'cod_farmaco',max(payload->>'denominazione'),lower(max(payload->>'denominazione')),max(source_record_id::text)::uuid,$2 FROM staging_records WHERE snapshot_id=$1 GROUP BY payload->>'cod_farmaco'
ON CONFLICT(source_namespace,source_product_code) DO UPDATE SET name=EXCLUDED.name,normalized_name=EXCLUDED.normalized_name,source_record_id=EXCLUDED.source_record_id,observed_at=EXCLUDED.observed_at;
INSERT INTO pharmaceutical_forms(normalized_name,display_name,source_record_id) SELECT lower(payload->>'forma'),max(payload->>'forma'),max(source_record_id::text)::uuid FROM staging_records WHERE snapshot_id=$1 AND coalesce(payload->>'forma','')<>'' GROUP BY lower(payload->>'forma') ON CONFLICT(normalized_name) DO UPDATE SET display_name=EXCLUDED.display_name,source_record_id=EXCLUDED.source_record_id;
INSERT INTO marketing_authorizations(aic,product_id,holder_organization_id,administrative_status,procedure_type,source_record_id,observed_at)
SELECT lpad(s.payload->>'aic',9,'0'),mp.id,o.id,s.payload->>'stato_amministrativo',s.payload->>'tipo_procedura',s.source_record_id,$2 FROM staging_records s JOIN medicinal_products mp ON mp.source_namespace='AIFA' AND mp.source_product_code=s.payload->>'cod_farmaco' LEFT JOIN organizations o ON o.authority='AIFA' AND o.source_code=s.payload->>'codice_ditta' WHERE s.snapshot_id=$1
ON CONFLICT(aic) DO UPDATE SET product_id=EXCLUDED.product_id,holder_organization_id=EXCLUDED.holder_organization_id,administrative_status=EXCLUDED.administrative_status,procedure_type=EXCLUDED.procedure_type,source_record_id=EXCLUDED.source_record_id,observed_at=EXCLUDED.observed_at;
INSERT INTO packages(marketing_authorization_id,product_id,source_package_code,description,pharmaceutical_form_id,supply_regime,compact_active_substances,leaflet_url,smpc_url,source_record_id,observed_at)
SELECT ma.id,mp.id,s.payload->>'cod_confezione',s.payload->>'descrizione',pf.id,s.payload->>'fornitura',s.payload->>'pa_associati',s.payload->>'link_fi',s.payload->>'link_rcp',s.source_record_id,$2 FROM staging_records s JOIN marketing_authorizations ma ON ma.aic=lpad(s.payload->>'aic',9,'0') JOIN medicinal_products mp ON mp.id=ma.product_id LEFT JOIN pharmaceutical_forms pf ON pf.normalized_name=lower(s.payload->>'forma') WHERE s.snapshot_id=$1
ON CONFLICT(marketing_authorization_id) DO UPDATE SET product_id=EXCLUDED.product_id,source_package_code=EXCLUDED.source_package_code,description=EXCLUDED.description,pharmaceutical_form_id=EXCLUDED.pharmaceutical_form_id,supply_regime=EXCLUDED.supply_regime,compact_active_substances=EXCLUDED.compact_active_substances,leaflet_url=EXCLUDED.leaflet_url,smpc_url=EXCLUDED.smpc_url,source_record_id=EXCLUDED.source_record_id,observed_at=EXCLUDED.observed_at;
INSERT INTO package_atc(package_id,atc_code,source_record_id) SELECT p.id,a.code,s.source_record_id FROM staging_records s JOIN marketing_authorizations ma ON ma.aic=lpad(s.payload->>'aic',9,'0') JOIN packages p ON p.marketing_authorization_id=ma.id JOIN atc_classifications a ON a.code=s.payload->>'codice_atc' WHERE s.snapshot_id=$1 ON CONFLICT DO NOTHING;
UPDATE staging_records SET state='PUBLISHED' WHERE snapshot_id=$1;`
const publishIngredientsSQL = `
INSERT INTO active_substances(normalized_name,display_name,source_record_id,observed_at) SELECT lower(payload->>'principio_attivo'),max(payload->>'principio_attivo'),max(source_record_id::text)::uuid,$2 FROM staging_records WHERE snapshot_id=$1 AND upper(payload->>'principio_attivo') NOT IN ('','N.D.') GROUP BY lower(payload->>'principio_attivo') ON CONFLICT(normalized_name) DO UPDATE SET display_name=EXCLUDED.display_name,source_record_id=EXCLUDED.source_record_id,observed_at=EXCLUDED.observed_at;
DELETE FROM package_ingredients pi USING packages p JOIN marketing_authorizations ma ON ma.id=p.marketing_authorization_id WHERE pi.package_id=p.id AND EXISTS(SELECT 1 FROM staging_records s WHERE s.snapshot_id=$1 AND lpad(s.payload->>'aic',9,'0')=ma.aic);
INSERT INTO package_ingredients(package_id,active_substance_id,ordinal,quantity,unit_normalized,quantity_raw,unit_raw,source_record_id,observed_at)
SELECT p.id,a.id,row_number() OVER(PARTITION BY p.id ORDER BY s.id),CASE WHEN s.payload->>'quantita' ~ '^[0-9]+([.,][0-9]+)?$' THEN replace(s.payload->>'quantita',',','.')::numeric END,lower(nullif(s.payload->>'unita_misura','N.D.')),s.payload->>'quantita',s.payload->>'unita_misura',s.source_record_id,$2 FROM staging_records s JOIN marketing_authorizations ma ON ma.aic=lpad(s.payload->>'aic',9,'0') JOIN packages p ON p.marketing_authorization_id=ma.id JOIN active_substances a ON a.normalized_name=lower(s.payload->>'principio_attivo') WHERE s.snapshot_id=$1 AND upper(s.payload->>'principio_attivo') NOT IN ('','N.D.');
UPDATE staging_records SET state='PUBLISHED' WHERE snapshot_id=$1;`
const publishATCSQL = `
INSERT INTO atc_classifications(code,description,level,source_record_id,observed_at) SELECT payload->>'codice_atc',payload->>'descrizione',CASE length(payload->>'codice_atc') WHEN 1 THEN 1 WHEN 3 THEN 2 WHEN 4 THEN 3 WHEN 5 THEN 4 ELSE 5 END,source_record_id,$2 FROM staging_records WHERE snapshot_id=$1 ON CONFLICT(code) DO UPDATE SET description=EXCLUDED.description,level=EXCLUDED.level,source_record_id=EXCLUDED.source_record_id,observed_at=EXCLUDED.observed_at;
UPDATE atc_classifications SET parent_code=CASE level WHEN 2 THEN left(code,1) WHEN 3 THEN left(code,3) WHEN 4 THEN left(code,4) WHEN 5 THEN left(code,5) END WHERE level>1 AND EXISTS(SELECT 1 FROM atc_classifications p WHERE p.code=CASE atc_classifications.level WHEN 2 THEN left(atc_classifications.code,1) WHEN 3 THEN left(atc_classifications.code,3) WHEN 4 THEN left(atc_classifications.code,4) WHEN 5 THEN left(atc_classifications.code,5) END);
INSERT INTO package_atc(package_id,atc_code,source_record_id) SELECT p.id,a.code,p.source_record_id FROM packages p JOIN source_records sr ON sr.id=p.source_record_id JOIN LATERAL (SELECT sr.raw->>'CODICE_ATC' code) x ON true JOIN atc_classifications a ON a.code=x.code ON CONFLICT DO NOTHING;
UPDATE staging_records SET state='PUBLISHED' WHERE snapshot_id=$1;`
const publishTransparencySQL = `
CREATE TEMP TABLE previous_group_lineage ON COMMIT DROP AS SELECT source_group_identifier,lineage_id FROM official_equivalence_groups WHERE authority='AIFA' AND relationship_type='AIFA_TRANSPARENCY_OFFICIAL' AND valid_to IS NULL;
UPDATE official_equivalence_memberships SET valid_to=$3 WHERE valid_to IS NULL AND group_id IN(SELECT id FROM official_equivalence_groups WHERE authority='AIFA' AND relationship_type='AIFA_TRANSPARENCY_OFFICIAL' AND valid_to IS NULL);
UPDATE official_equivalence_groups SET valid_to=$3 WHERE authority='AIFA' AND relationship_type='AIFA_TRANSPARENCY_OFFICIAL' AND valid_to IS NULL;
INSERT INTO official_equivalence_groups(lineage_id,authority,relationship_type,source_group_identifier,source_group_label,normalized_group_key,member_fingerprint,attributes,source_artifact_id,published_date,valid_from)
SELECT coalesce(max(pl.lineage_id::text)::uuid,gen_random_uuid()),'AIFA','AIFA_TRANSPARENCY_OFFICIAL',s.payload->>'codice_gruppo_equivalenza',max(s.payload->>'confezione_di_riferimento'),lower(max(s.payload->>'confezione_di_riferimento')),encode(digest(string_agg(lpad(s.payload->>'aic',9,'0'),',' ORDER BY lpad(s.payload->>'aic',9,'0')),'sha256'),'hex'),jsonb_build_object('active_substance',max(s.payload->>'principio_attivo'),'atc',max(s.payload->>'atc')),$2,$3::date,$3 FROM staging_records s LEFT JOIN previous_group_lineage pl ON pl.source_group_identifier=s.payload->>'codice_gruppo_equivalenza' WHERE s.snapshot_id=$1 GROUP BY s.payload->>'codice_gruppo_equivalenza';
INSERT INTO official_equivalence_memberships(group_id,package_id,source_record_id,valid_from) SELECT g.id,p.id,s.source_record_id,$3 FROM staging_records s JOIN official_equivalence_groups g ON g.authority='AIFA' AND g.relationship_type='AIFA_TRANSPARENCY_OFFICIAL' AND g.source_group_identifier=s.payload->>'codice_gruppo_equivalenza' AND g.valid_to IS NULL JOIN marketing_authorizations ma ON ma.aic=lpad(s.payload->>'aic',9,'0') JOIN packages p ON p.marketing_authorization_id=ma.id WHERE s.snapshot_id=$1;
INSERT INTO normalization_warnings(ingestion_run_id,source_record_id,severity,code,message,context) SELECT (SELECT ingestion_run_id FROM source_snapshots WHERE id=$1),s.source_record_id,'HIGH','UNRESOLVED_OFFICIAL_MEMBER','Official AIFA member AIC does not match the package snapshot',jsonb_build_object('aic',s.payload->>'aic') FROM staging_records s LEFT JOIN marketing_authorizations ma ON ma.aic=lpad(s.payload->>'aic',9,'0') WHERE s.snapshot_id=$1 AND ma.id IS NULL;
INSERT INTO price_observations(group_id,package_id,kind,amount,currency,source_record_id,source_artifact_id,published_date,observed_at,valid_from) SELECT DISTINCT ON(g.id) g.id,NULL,'REFERENCE_PRICE',parse_aifa_money(s.payload->>'prezzo_riferimento_ssn'),'EUR',s.source_record_id,$2,$3::date,$3,$3 FROM staging_records s JOIN official_equivalence_groups g ON g.source_group_identifier=s.payload->>'codice_gruppo_equivalenza' AND g.valid_to IS NULL WHERE s.snapshot_id=$1 AND parse_aifa_money(s.payload->>'prezzo_riferimento_ssn') IS NOT NULL ORDER BY g.id,s.id;
INSERT INTO price_observations(group_id,package_id,kind,amount,currency,source_record_id,source_artifact_id,published_date,observed_at,valid_from) SELECT g.id,p.id,'PUBLIC_PRICE',parse_aifa_money(s.payload->>'prezzo_pubblico'),'EUR',s.source_record_id,$2,$3::date,$3,$3 FROM staging_records s JOIN official_equivalence_groups g ON g.source_group_identifier=s.payload->>'codice_gruppo_equivalenza' AND g.valid_to IS NULL LEFT JOIN marketing_authorizations ma ON ma.aic=lpad(s.payload->>'aic',9,'0') LEFT JOIN packages p ON p.marketing_authorization_id=ma.id WHERE s.snapshot_id=$1 AND parse_aifa_money(s.payload->>'prezzo_pubblico') IS NOT NULL;
INSERT INTO normalization_warnings(ingestion_run_id,source_record_id,severity,code,message,context) SELECT (SELECT ingestion_run_id FROM source_snapshots WHERE id=$1),s.source_record_id,'MEDIUM','INVALID_PRICE','AIFA price cannot be parsed; membership retained without this price',jsonb_build_object('field',v.field,'value',v.raw_value) FROM staging_records s CROSS JOIN LATERAL (VALUES ('prezzo_riferimento_ssn',s.payload->>'prezzo_riferimento_ssn'),('prezzo_pubblico',s.payload->>'prezzo_pubblico')) v(field,raw_value) WHERE s.snapshot_id=$1 AND coalesce(trim(v.raw_value),'')<>'' AND parse_aifa_money(v.raw_value) IS NULL;
UPDATE staging_records SET state='PUBLISHED' WHERE snapshot_id=$1;`
const publishShortagesSQL = `
INSERT INTO shortage_episodes(package_id,start_date,expected_end_date,reason,equivalent_declared,aifa_guidance,aifa_note,reimbursement_class,row_fingerprint,source_record_id,observed_at)
SELECT p.id,to_date(s.payload->>'data_inizio','DD/MM/YYYY'),CASE WHEN s.payload->>'fine_presunta'='' THEN NULL ELSE to_date(s.payload->>'fine_presunta','DD/MM/YYYY') END,s.payload->>'motivazioni',lower(s.payload->>'equivalente') IN ('sì','si'),s.payload->>'suggerimenti_indicazioni_aifa',s.payload->>'nota_aifa',s.payload->>'classe_di_rimborsabilita',sr.record_hash,s.source_record_id,$2 FROM staging_records s JOIN source_records sr ON sr.id=s.source_record_id JOIN marketing_authorizations ma ON ma.aic=lpad(s.payload->>'aic',9,'0') JOIN packages p ON p.marketing_authorization_id=ma.id WHERE s.snapshot_id=$1 ON CONFLICT(package_id,start_date,row_fingerprint) DO NOTHING;
UPDATE staging_records SET state='PUBLISHED' WHERE snapshot_id=$1;`
