package catalog

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestOpenAPISpecRoute(t *testing.T) {
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/openapi.yaml", nil)
	(&API{}).Router().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d", recorder.Code)
	}
	if contentType := recorder.Header().Get("Content-Type"); contentType != "application/yaml; charset=utf-8" {
		t.Fatalf("unexpected content type: %s", contentType)
	}
	if !strings.Contains(recorder.Body.String(), "openapi: 3.1.0") {
		t.Fatal("embedded OpenAPI document missing expected version")
	}
}

func TestSwaggerDocsRoute(t *testing.T) {
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/docs", nil)
	(&API{}).Router().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d", recorder.Code)
	}
	if !strings.Contains(recorder.Body.String(), "SwaggerUIBundle") {
		t.Fatal("Swagger UI bootstrap not found")
	}
}
