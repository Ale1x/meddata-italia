export type NamedEntity = { id: string; name: string }

export type Ingredient = NamedEntity & {
  quantity: number | null
  quantity_raw: string | null
  unit: string | null
  unit_raw: string | null
}

export type Provenance = {
  source: string
  artifact_hash: string
  downloaded_at: string
  observed_at: string
}

export type TransparencyGroup = {
  authority: string
  group_id: string
  label: string
  published_date: string
  source_group_identifier: string
}

export type PackageData = {
  id: string
  aic: string
  medicine: NamedEntity
  package_description: string
  active_substances: Ingredient[]
  pharmaceutical_form: NamedEntity | null
  authorization_holder: NamedEntity | null
  administrative_status: string | null
  supply_regime: string | null
  atc: { code: string; description: string; level: number }[]
  transparency_group?: TransparencyGroup
  /** @deprecated Use transparency_group. */
  official_equivalence?: TransparencyGroup
  provenance?: Provenance[]
  observed_at: string
}

export type MedicineSummary = {
  id: string
  source_product_code: string
  name: string
  observed_at: string
}

export type MedicinePackage = {
  id: string
  aic: string
  description: string
  observed_at: string
}

export type SubstancePackage = {
  id: string
  aic: string
  name: string
  description: string
  observed_at: string
  quantity: number | null
  unit: string | null
  quantity_raw: string | null
  unit_raw: string | null
  pharmaceutical_form: string | null
  administration_route: string | null
  supply_regime: string | null
  administrative_status: string | null
  authorization_holder: string | null
  ingredient_count: number
  in_official_list: boolean
}

export type MedicineData = MedicineSummary & {
  packages: MedicinePackage[]
}

export type Equivalent = { id: string; aic: string; name: string; description: string }

export type EquivalenceData = {
  authority: string
  source: string
  source_publication_date: string
  group_source_identifier: string
  group_label: string
  members: Equivalent[]
  reference_prices: { kind: string; amount: number; currency: string }[]
  artifact_hash: string
}

export type ComparedPackage = {
  id: string
  aic: string
  name: string
  description: string
  official_group: { source_group_identifier: string; label: string; published_date: string } | null
}

export type ComparisonData = {
  equivalent: boolean
  same_transparency_group: boolean
  basis: "AIFA_TRANSPARENCY_LIST_GROUP_MEMBERSHIP"
  interpretation_notice: string
  semantics: "AIFA_TRANSPARENCY_OFFICIAL"
  reason: "SAME_PACKAGE" | "SAME_OFFICIAL_GROUP" | "DIFFERENT_OFFICIAL_GROUPS" | "LEFT_NOT_IN_OFFICIAL_LIST" | "RIGHT_NOT_IN_OFFICIAL_LIST" | "NEITHER_IN_OFFICIAL_LIST"
  left: ComparedPackage
  right: ComparedPackage
  shared_official_group: { source_group_identifier: string; label: string; published_date: string } | null
}

export type IngestionSummary = {
  source_id: string
  status: string
  finished_at: string | null
}

export type SourceSummary = {
  id: string
  declared_frequency: string
}

export type ApiEnvelope<T> = {
  data: T
  meta: {
    request_id: string
    data_freshness?: Record<string, string | null>
  }
}
