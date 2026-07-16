import type { PackageData } from "@/lib/types"

export type RelatedResultDecision =
  | { mode: "official-equivalents"; substance: null }
  | { mode: "same-active-substance"; substance: PackageData["active_substances"][number] }
  | { mode: "none"; substance: null }

export function selectRelatedResults(pkg: PackageData): RelatedResultDecision {
  if (pkg.official_equivalence) {
    return { mode: "official-equivalents", substance: null }
  }
  const distinctSubstances = Array.from(new Map(pkg.active_substances.map((substance) => [substance.id, substance])).values())
  if (distinctSubstances.length === 1) {
    return { mode: "same-active-substance", substance: distinctSubstances[0] }
  }
  return { mode: "none", substance: null }
}
