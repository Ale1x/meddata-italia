package catalog

import (
	"github.com/Ale1x/meddata-italia/internal/platform"
	"github.com/prometheus/client_golang/prometheus"
	"io"
	"log/slog"
	"net/http/httptest"
	"testing"
)

func TestLiveness(t *testing.T) {
	reg := prometheus.NewRegistry()
	api := &API{Logger: slog.New(slog.NewTextHandler(io.Discard, nil)), Metrics: platform.NewMetrics(reg)}
	rec := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/health/live", nil)
	api.Router().ServeHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatalf("status=%d", rec.Code)
	}
}

func TestOfficialComparisonReason(t *testing.T) {
	tests := []struct {
		name                        string
		leftOfficial, rightOfficial bool
		sameGroup                   bool
		want                        string
	}{
		{"same group", true, true, true, "SAME_OFFICIAL_GROUP"},
		{"different groups", true, true, false, "DIFFERENT_OFFICIAL_GROUPS"},
		{"left absent", false, true, false, "LEFT_NOT_IN_OFFICIAL_LIST"},
		{"right absent", true, false, false, "RIGHT_NOT_IN_OFFICIAL_LIST"},
		{"both absent", false, false, false, "NEITHER_IN_OFFICIAL_LIST"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := officialComparisonReason(tt.leftOfficial, tt.rightOfficial, tt.sameGroup); got != tt.want {
				t.Fatalf("reason=%q want=%q", got, tt.want)
			}
		})
	}
}
