package catalogaudit

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Severity string

const (
	SeverityError   Severity = "ERROR"
	SeverityWarning Severity = "WARNING"
)

type RecommendationMode string

const (
	RecommendationOfficial      RecommendationMode = "OFFICIAL_EQUIVALENTS"
	RecommendationSameSubstance RecommendationMode = "SAME_ACTIVE_SUBSTANCE"
	RecommendationNone          RecommendationMode = "NONE"
)

type Summary struct {
	Packages                     int64 `json:"packages"`
	ActiveSubstances             int64 `json:"active_substances"`
	CurrentOfficialGroups        int64 `json:"current_official_groups"`
	CurrentOfficialMemberships   int64 `json:"current_official_memberships"`
	OfficialRecommendations      int64 `json:"official_recommendations"`
	SameSubstanceRecommendations int64 `json:"same_substance_recommendations"`
	NoRecommendations            int64 `json:"no_recommendations"`
	PackagesWithoutIngredients   int64 `json:"packages_without_ingredients"`
	MaxPackagesForOneSubstance   int64 `json:"max_packages_for_one_substance"`
}

type Finding struct {
	Code     string   `json:"code"`
	Severity Severity `json:"severity"`
	Count    int64    `json:"count"`
	Detail   string   `json:"detail"`
	Examples []string `json:"examples,omitempty"`
}

type Report struct {
	GeneratedAt time.Time `json:"generated_at"`
	Duration    string    `json:"duration"`
	Summary     Summary   `json:"summary"`
	Findings    []Finding `json:"findings"`
}

func (r Report) ErrorCount() int64 {
	var count int64
	for _, finding := range r.Findings {
		if finding.Severity == SeverityError {
			count += finding.Count
		}
	}
	return count
}

func (r Report) WarningCount() int64 {
	var count int64
	for _, finding := range r.Findings {
		if finding.Severity == SeverityWarning {
			count += finding.Count
		}
	}
	return count
}

func SelectRecommendationMode(currentOfficialGroups, distinctIngredients int64) RecommendationMode {
	if currentOfficialGroups > 0 {
		return RecommendationOfficial
	}
	if distinctIngredients == 1 {
		return RecommendationSameSubstance
	}
	return RecommendationNone
}

type checkSpec struct {
	code         string
	severity     Severity
	detail       string
	countQuery   string
	exampleQuery string
}

var checks = []checkSpec{
	{
		code: "INVALID_AIC", severity: SeverityError,
		detail:       "AIC canonici non composti da esattamente nove cifre.",
		countQuery:   `SELECT count(*) FROM marketing_authorizations WHERE btrim(aic) !~ '^[0-9]{9}$'`,
		exampleQuery: `SELECT btrim(aic) FROM marketing_authorizations WHERE btrim(aic) !~ '^[0-9]{9}$' ORDER BY aic LIMIT $1`,
	},
	{
		code: "DUPLICATE_AIC", severity: SeverityError,
		detail:       "AIC associati a più autorizzazioni canoniche.",
		countQuery:   `SELECT count(*) FROM (SELECT aic FROM marketing_authorizations GROUP BY aic HAVING count(*) > 1) duplicates`,
		exampleQuery: `SELECT btrim(aic) FROM marketing_authorizations GROUP BY aic HAVING count(*) > 1 ORDER BY aic LIMIT $1`,
	},
	{
		code: "PACKAGE_PRODUCT_MISMATCH", severity: SeverityError,
		detail:       "Confezioni e autorizzazioni collegate a medicinali differenti.",
		countQuery:   `SELECT count(*) FROM packages p JOIN marketing_authorizations ma ON ma.id=p.marketing_authorization_id WHERE p.product_id <> ma.product_id`,
		exampleQuery: `SELECT btrim(ma.aic) FROM packages p JOIN marketing_authorizations ma ON ma.id=p.marketing_authorization_id WHERE p.product_id <> ma.product_id ORDER BY ma.aic LIMIT $1`,
	},
	{
		code: "REPEATED_PACKAGE_INGREDIENT", severity: SeverityWarning,
		detail: "La stessa sostanza attiva compare in più righe della confezione, per esempio per dosaggi o fasi differenti.",
		countQuery: `SELECT count(*) FROM (
			SELECT package_id, active_substance_id FROM package_ingredients
			GROUP BY package_id, active_substance_id HAVING count(*) > 1
		) duplicates`,
		exampleQuery: `SELECT btrim(ma.aic) || ':' || s.display_name
			FROM package_ingredients pi
			JOIN packages p ON p.id=pi.package_id
			JOIN marketing_authorizations ma ON ma.id=p.marketing_authorization_id
			JOIN active_substances s ON s.id=pi.active_substance_id
			GROUP BY ma.aic, s.display_name, pi.package_id, pi.active_substance_id
			HAVING count(*) > 1 ORDER BY ma.aic LIMIT $1`,
	},
	{
		code: "MULTIPLE_CURRENT_OFFICIAL_GROUPS", severity: SeverityError,
		detail: "Una confezione appartiene contemporaneamente a più gruppi ufficiali correnti.",
		countQuery: `SELECT count(*) FROM (
			SELECT m.package_id FROM official_equivalence_memberships m
			JOIN official_equivalence_groups g ON g.id=m.group_id
			WHERE m.valid_to IS NULL AND g.valid_to IS NULL AND g.relationship_type='AIFA_TRANSPARENCY_OFFICIAL'
			GROUP BY m.package_id HAVING count(DISTINCT m.group_id) > 1
		) ambiguous`,
		exampleQuery: `SELECT btrim(ma.aic)
			FROM official_equivalence_memberships m
			JOIN official_equivalence_groups g ON g.id=m.group_id
			JOIN packages p ON p.id=m.package_id
			JOIN marketing_authorizations ma ON ma.id=p.marketing_authorization_id
			WHERE m.valid_to IS NULL AND g.valid_to IS NULL AND g.relationship_type='AIFA_TRANSPARENCY_OFFICIAL'
			GROUP BY ma.aic, m.package_id HAVING count(DISTINCT m.group_id) > 1 ORDER BY ma.aic LIMIT $1`,
	},
	{
		code: "CURRENT_MEMBERSHIP_IN_CLOSED_GROUP", severity: SeverityError,
		detail:       "Appartenenze ancora aperte puntano a gruppi già chiusi.",
		countQuery:   `SELECT count(*) FROM official_equivalence_memberships m JOIN official_equivalence_groups g ON g.id=m.group_id WHERE m.valid_to IS NULL AND g.valid_to IS NOT NULL`,
		exampleQuery: `SELECT btrim(ma.aic) || ':' || g.source_group_identifier FROM official_equivalence_memberships m JOIN official_equivalence_groups g ON g.id=m.group_id JOIN packages p ON p.id=m.package_id JOIN marketing_authorizations ma ON ma.id=p.marketing_authorization_id WHERE m.valid_to IS NULL AND g.valid_to IS NOT NULL ORDER BY ma.aic LIMIT $1`,
	},
	{
		code: "INVALID_OFFICIAL_GROUP_PROVENANCE", severity: SeverityError,
		detail: "Gruppi pubblici correnti non riconducibili alla lista di trasparenza ufficiale AIFA.",
		countQuery: `SELECT count(*) FROM official_equivalence_groups g
			JOIN source_artifacts a ON a.id=g.source_artifact_id
			WHERE g.valid_to IS NULL AND (g.authority <> 'AIFA' OR g.relationship_type <> 'AIFA_TRANSPARENCY_OFFICIAL' OR a.source_id <> 'aifa-transparency-list')`,
		exampleQuery: `SELECT g.source_group_identifier FROM official_equivalence_groups g
			JOIN source_artifacts a ON a.id=g.source_artifact_id
			WHERE g.valid_to IS NULL AND (g.authority <> 'AIFA' OR g.relationship_type <> 'AIFA_TRANSPARENCY_OFFICIAL' OR a.source_id <> 'aifa-transparency-list')
			ORDER BY g.source_group_identifier LIMIT $1`,
	},
	{
		code: "OFFICIAL_GROUP_WITHOUT_PEERS", severity: SeverityWarning,
		detail: "Gruppi ufficiali correnti con meno di due confezioni; l'endpoint non può mostrare alternative.",
		countQuery: `SELECT count(*) FROM (
			SELECT g.id FROM official_equivalence_groups g
			LEFT JOIN official_equivalence_memberships m ON m.group_id=g.id AND m.valid_to IS NULL
			WHERE g.valid_to IS NULL GROUP BY g.id HAVING count(m.id) < 2
		) small_groups`,
		exampleQuery: `SELECT g.source_group_identifier FROM official_equivalence_groups g
			LEFT JOIN official_equivalence_memberships m ON m.group_id=g.id AND m.valid_to IS NULL
			WHERE g.valid_to IS NULL GROUP BY g.id, g.source_group_identifier HAVING count(m.id) < 2
			ORDER BY g.source_group_identifier LIMIT $1`,
	},
	{
		code: "PACKAGE_WITHOUT_INGREDIENT", severity: SeverityWarning,
		detail:       "Confezioni senza un principio attivo normalizzato; non ricevono suggerimenti per composizione.",
		countQuery:   `SELECT count(*) FROM packages p WHERE NOT EXISTS (SELECT 1 FROM package_ingredients pi WHERE pi.package_id=p.id)`,
		exampleQuery: `SELECT btrim(ma.aic) FROM packages p JOIN marketing_authorizations ma ON ma.id=p.marketing_authorization_id WHERE NOT EXISTS (SELECT 1 FROM package_ingredients pi WHERE pi.package_id=p.id) ORDER BY ma.aic LIMIT $1`,
	},
	{
		code: "OFFICIAL_PACKAGE_WITHOUT_INGREDIENT", severity: SeverityWarning,
		detail: "Confezioni in un gruppo ufficiale prive di principio attivo normalizzato.",
		countQuery: `SELECT count(DISTINCT m.package_id) FROM official_equivalence_memberships m
			JOIN official_equivalence_groups g ON g.id=m.group_id
			WHERE m.valid_to IS NULL AND g.valid_to IS NULL
			AND NOT EXISTS (SELECT 1 FROM package_ingredients pi WHERE pi.package_id=m.package_id)`,
		exampleQuery: `SELECT DISTINCT btrim(ma.aic) FROM official_equivalence_memberships m
			JOIN official_equivalence_groups g ON g.id=m.group_id
			JOIN packages p ON p.id=m.package_id JOIN marketing_authorizations ma ON ma.id=p.marketing_authorization_id
			WHERE m.valid_to IS NULL AND g.valid_to IS NULL
			AND NOT EXISTS (SELECT 1 FROM package_ingredients pi WHERE pi.package_id=m.package_id)
			ORDER BY btrim(ma.aic) LIMIT $1`,
	},
}

func Run(ctx context.Context, pool *pgxpool.Pool, exampleLimit int) (Report, error) {
	started := time.Now()
	if exampleLimit < 0 {
		exampleLimit = 0
	}
	report := Report{GeneratedAt: started.UTC()}
	if err := pool.QueryRow(ctx, summaryQuery).Scan(
		&report.Summary.Packages,
		&report.Summary.ActiveSubstances,
		&report.Summary.CurrentOfficialGroups,
		&report.Summary.CurrentOfficialMemberships,
		&report.Summary.OfficialRecommendations,
		&report.Summary.SameSubstanceRecommendations,
		&report.Summary.NoRecommendations,
		&report.Summary.PackagesWithoutIngredients,
		&report.Summary.MaxPackagesForOneSubstance,
	); err != nil {
		return Report{}, fmt.Errorf("catalog audit summary: %w", err)
	}

	for _, spec := range checks {
		finding := Finding{Code: spec.code, Severity: spec.severity, Detail: spec.detail}
		if err := pool.QueryRow(ctx, spec.countQuery).Scan(&finding.Count); err != nil {
			return Report{}, fmt.Errorf("catalog audit %s count: %w", spec.code, err)
		}
		if finding.Count == 0 {
			continue
		}
		if exampleLimit > 0 {
			rows, err := pool.Query(ctx, spec.exampleQuery, exampleLimit)
			if err != nil {
				return Report{}, fmt.Errorf("catalog audit %s examples: %w", spec.code, err)
			}
			for rows.Next() {
				var example string
				if err := rows.Scan(&example); err != nil {
					rows.Close()
					return Report{}, fmt.Errorf("catalog audit %s example: %w", spec.code, err)
				}
				finding.Examples = append(finding.Examples, example)
			}
			if err := rows.Err(); err != nil {
				rows.Close()
				return Report{}, fmt.Errorf("catalog audit %s examples: %w", spec.code, err)
			}
			rows.Close()
		}
		report.Findings = append(report.Findings, finding)
	}
	report.Duration = time.Since(started).Round(time.Millisecond).String()
	return report, nil
}

const summaryQuery = `
WITH package_facts AS (
  SELECT p.id,
         count(DISTINCT pi.active_substance_id) AS ingredient_count,
         count(DISTINCT m.group_id) FILTER (
           WHERE m.valid_to IS NULL AND g.valid_to IS NULL
             AND g.relationship_type='AIFA_TRANSPARENCY_OFFICIAL'
         ) AS official_group_count
  FROM packages p
  LEFT JOIN package_ingredients pi ON pi.package_id=p.id
  LEFT JOIN official_equivalence_memberships m ON m.package_id=p.id
  LEFT JOIN official_equivalence_groups g ON g.id=m.group_id
  GROUP BY p.id
), substance_sizes AS (
  SELECT count(DISTINCT package_id) AS package_count
  FROM package_ingredients GROUP BY active_substance_id
)
SELECT
  count(*) AS packages,
  (SELECT count(*) FROM active_substances),
  (SELECT count(*) FROM official_equivalence_groups WHERE valid_to IS NULL),
  (SELECT count(*) FROM official_equivalence_memberships m JOIN official_equivalence_groups g ON g.id=m.group_id WHERE m.valid_to IS NULL AND g.valid_to IS NULL),
  count(*) FILTER (WHERE official_group_count > 0),
  count(*) FILTER (WHERE official_group_count = 0 AND ingredient_count = 1),
  count(*) FILTER (WHERE official_group_count = 0 AND ingredient_count <> 1),
  count(*) FILTER (WHERE ingredient_count = 0),
  coalesce((SELECT max(package_count) FROM substance_sizes), 0)
FROM package_facts`
