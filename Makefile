.PHONY: build test frontend-test integration catalog-audit catalog-audit-strict vet fmt fmt-check sqlc migrate-up discovery openapi-lint compose-up compose-down scheduler

build:
	go build ./cmd/...

test:
	go test ./...

frontend-test:
	npm test --prefix frontend

integration:
	RUN_INTEGRATION=1 go test -count=1 -tags=integration -v ./integration

catalog-audit:
	go run ./cmd/catalog-audit

catalog-audit-strict:
	go run ./cmd/catalog-audit --strict

vet:
	go vet ./...

fmt:
	gofmt -w $$(find . -name '*.go' -not -path './vendor/*')

fmt-check:
	test -z "$$(gofmt -l $$(find . -name '*.go' -not -path './vendor/*'))"

sqlc:
	sqlc generate

migrate-up:
	go run ./cmd/migrate up

discovery:
	go run ./cmd/data-discovery /tmp/med-discovery docs/data-discovery/generated

openapi-lint:
	npx --yes @redocly/cli lint api/openapi.yaml

compose-up:
	docker compose up -d --build

compose-down:
	docker compose down

scheduler:
	docker compose --profile tools run --rm ingestion-scheduler --source=aifa-packages
