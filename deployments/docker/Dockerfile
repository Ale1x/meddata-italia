FROM --platform=$BUILDPLATFORM golang:1.26-alpine AS build
WORKDIR /src
RUN apk add --no-cache ca-certificates git
COPY deployments/docker/certs/actalis-domain-validation-server-ca-g3.crt /usr/local/share/ca-certificates/
RUN update-ca-certificates
COPY go.mod go.sum ./
RUN go mod download
COPY . .
ARG SERVICE=public-api
ARG TARGETOS
ARG TARGETARCH
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -trimpath -ldflags="-s -w" -o /out/service ./cmd/${SERVICE}

FROM gcr.io/distroless/static-debian12:debug-nonroot
ARG SERVICE=service
ARG VCS_REF=unknown
LABEL org.opencontainers.image.source="https://github.com/Ale1x/meddata-italia" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.title="meddata-italia-${SERVICE}"
WORKDIR /app
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=build /out/service /app/service
COPY configs /app/configs
COPY db/migrations /app/db/migrations
USER nonroot:nonroot
ENTRYPOINT ["/app/service"]
