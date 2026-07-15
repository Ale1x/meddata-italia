# ADR-001: Service boundaries

Status: Accepted — 2026-07-15

Use three binaries: stateless `public-api`, short-lived `ingestion-scheduler`, and stateful workflow `ingestion-worker`. Downloader, profiler, parser, normalizer and publisher are packages in the worker, not microservices. This matches the required operational boundaries while keeping the first slice transactionally understandable. Split only after measured independent scaling or ownership needs.
