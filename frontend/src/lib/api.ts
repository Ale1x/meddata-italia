import type { ApiEnvelope, ComparisonData, EquivalenceData, IngestionSummary, PackageData, SourceSummary } from "@/lib/types"

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "")

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`)
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error?.detail ?? `Richiesta non riuscita (${response.status})`)
  }
  return response.json()
}

export function getPackageByAIC(aic: string) {
  return request<ApiEnvelope<PackageData>>(`/api/v1/packages/by-aic/${encodeURIComponent(aic)}?include=provenance`)
}

export function getOfficialEquivalents(packageID: string) {
  return request<ApiEnvelope<EquivalenceData>>(`/api/v1/packages/${encodeURIComponent(packageID)}/official-equivalents`)
}

export function compareOfficialEquivalence(leftAIC: string, rightAIC: string) {
  const query = new URLSearchParams({ left_aic: leftAIC, right_aic: rightAIC })
  return request<ApiEnvelope<ComparisonData>>(`/api/v1/official-equivalence/compare?${query}`)
}

export function getLatestIngestions() {
  return request<ApiEnvelope<IngestionSummary[]>>("/api/v1/ingestions/latest")
}

export function getSources() {
  return request<ApiEnvelope<SourceSummary[]>>("/api/v1/sources")
}

export function normalizeAIC(value: string) {
  return value.replace(/\D/g, "").slice(0, 9)
}
