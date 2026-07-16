package api

import _ "embed"

// OpenAPISpec is the versioned public API contract served by public-api.
//
//go:embed openapi.yaml
var OpenAPISpec []byte
