package catalogaudit

import "testing"

func TestSelectRecommendationMode(t *testing.T) {
	tests := []struct {
		name           string
		officialGroups int64
		ingredients    int64
		want           RecommendationMode
	}{
		{name: "official mono ingredient", officialGroups: 1, ingredients: 1, want: RecommendationOfficial},
		{name: "official combination", officialGroups: 1, ingredients: 2, want: RecommendationOfficial},
		{name: "official takes precedence over ambiguous ingredients", officialGroups: 1, ingredients: 0, want: RecommendationOfficial},
		{name: "single ingredient fallback", ingredients: 1, want: RecommendationSameSubstance},
		{name: "combination without official group", ingredients: 2, want: RecommendationNone},
		{name: "missing ingredients", ingredients: 0, want: RecommendationNone},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := SelectRecommendationMode(test.officialGroups, test.ingredients); got != test.want {
				t.Fatalf("mode=%s want=%s", got, test.want)
			}
		})
	}
}

func TestReportCountsFindingsBySeverity(t *testing.T) {
	report := Report{Findings: []Finding{
		{Severity: SeverityError, Count: 2},
		{Severity: SeverityWarning, Count: 3},
		{Severity: SeverityError, Count: 5},
	}}
	if got := report.ErrorCount(); got != 7 {
		t.Fatalf("errors=%d want=7", got)
	}
	if got := report.WarningCount(); got != 3 {
		t.Fatalf("warnings=%d want=3", got)
	}
}
