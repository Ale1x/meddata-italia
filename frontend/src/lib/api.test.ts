import { afterEach, describe, expect, it, vi } from "vitest"
import { getPackagesByActiveSubstance } from "@/lib/api"
import type { SubstancePackage } from "@/lib/types"

function packageAt(index: number): SubstancePackage {
  return {
    id: `package-${index}`,
    aic: String(index).padStart(9, "0"),
    name: `MEDICINALE ${index}`,
    description: "CONFEZIONE",
    observed_at: "2026-07-16T00:00:00Z",
    quantity: 500,
    unit: "mg",
    quantity_raw: "500",
    unit_raw: "mg",
    pharmaceutical_form: "COMPRESSA",
    administration_route: null,
    supply_regime: null,
    administrative_status: null,
    authorization_holder: null,
    ingredient_count: 1,
    in_official_list: false,
  }
}

afterEach(() => vi.unstubAllGlobals())

describe("getPackagesByActiveSubstance", () => {
  it("keeps paginating beyond one thousand packages", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input), "http://localhost")
      const offset = Number(url.searchParams.get("offset"))
      const size = offset < 1000 ? 200 : 1
      const data = Array.from({ length: size }, (_, index) => packageAt(offset + index))
      return { ok: true, json: async () => ({ data, meta: { request_id: "test" } }) } as Response
    })
    vi.stubGlobal("fetch", fetchMock)

    const packages = await getPackagesByActiveSubstance("substance-id")

    expect(packages).toHaveLength(1001)
    expect(fetchMock).toHaveBeenCalledTimes(6)
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain("offset=1000")
  })
})
