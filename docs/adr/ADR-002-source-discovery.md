# ADR-002: Source discovery

Status: Accepted — 2026-07-15

Artifact URLs are discovered from official index HTML using configured link-text/format/URL patterns. The chosen link, page bytes, HTTP metadata and discovery timestamp are persisted. A static URL is an explicit override/fallback, never the only rule. This addresses observed dated links, stable-but-mutating URLs, and page/filename inconsistencies.
