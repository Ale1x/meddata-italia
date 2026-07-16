package discovery

import (
	"context"
	"github.com/Ale1x/meddata-italia/internal/sources"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestDiscoverCSV(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`<a href="/x/report.pdf">PDF</a><a href="/x/data_15.07.2026.csv">Elenco in formato .csv del 15/07/2026 [1.5 Mb] [CSV]</a>`))
	}))
	defer srv.Close()
	d := Discoverer{Client: srv.Client()}
	got, err := d.Discover(context.Background(), sources.Config{ID: "x", IndexURL: srv.URL, Discovery: sources.DiscoveryConfig{PreferredFormats: []string{"csv"}, LinkTextPatterns: []string{"formato .csv"}}})
	if err != nil {
		t.Fatal(err)
	}
	if got.Artifact.URL != srv.URL+"/x/data_15.07.2026.csv" {
		t.Fatalf("url=%s", got.Artifact.URL)
	}
	if got.Artifact.PublishedAt == nil {
		t.Fatal("date not parsed")
	}
}
