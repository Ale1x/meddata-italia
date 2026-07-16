import { describe, expect, it } from "vitest"
import { selectRelatedResults } from "@/lib/related-results"
import type { PackageData } from "@/lib/types"

function packageData(overrides: Partial<PackageData> = {}): PackageData {
  return {
    id: "package-id",
    aic: "012345678",
    medicine: { id: "medicine-id", name: "MEDICINALE" },
    package_description: "CONFEZIONE",
    active_substances: [],
    pharmaceutical_form: null,
    authorization_holder: null,
    administrative_status: null,
    supply_regime: null,
    atc: [],
    observed_at: "2026-07-16T00:00:00Z",
    ...overrides,
  }
}

const paracetamol = {
  id: "paracetamol-id",
  name: "PARACETAMOLO",
  quantity: 500,
  quantity_raw: "500",
  unit: "mg",
  unit_raw: "mg",
}

describe("selectRelatedResults", () => {
  it("prioritizes the official AIFA group for a single-ingredient package", () => {
    const result = selectRelatedResults(packageData({
      active_substances: [paracetamol],
      transparency_group: {
        authority: "AIFA",
        group_id: "group-id",
        label: "500 MG",
        published_date: "2026-07-15",
        source_group_identifier: "PMA",
      },
    }))
    expect(result).toEqual({ mode: "official-equivalents", substance: null })
  })

  it("uses the active-substance fallback only for one ingredient and no official group", () => {
    const result = selectRelatedResults(packageData({ active_substances: [paracetamol] }))
    expect(result).toEqual({ mode: "same-active-substance", substance: paracetamol })
  })

  it("treats repeated dosage rows for one substance as a single ingredient", () => {
    const secondDosage = { ...paracetamol, quantity: 1000, quantity_raw: "1000" }
    const result = selectRelatedResults(packageData({ active_substances: [paracetamol, secondDosage] }))
    expect(result).toEqual({ mode: "same-active-substance", substance: secondDosage })
  })

  it("does not suggest composition alternatives for combinations", () => {
    const result = selectRelatedResults(packageData({
      active_substances: [paracetamol, { ...paracetamol, id: "caffeine-id", name: "CAFFEINA" }],
    }))
    expect(result).toEqual({ mode: "none", substance: null })
  })

  it("does not suggest alternatives when normalized ingredients are unavailable", () => {
    expect(selectRelatedResults(packageData())).toEqual({ mode: "none", substance: null })
  })
})
