import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
  ArrowRight,
  CheckCircle,
  Clock,
  Database,
  Fingerprint,
  Flask,
  FunnelSimple,
  MagnifyingGlass,
  Package,
  ShieldCheck,
  Sparkle,
  X,
} from "@phosphor-icons/react"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SafetyNotice } from "@/components/safety-notice"
import { getOfficialEquivalents, getPackageByAIC, getPackagesByActiveSubstance, normalizeAIC } from "@/lib/api"
import { selectRelatedResults } from "@/lib/related-results"
import type { EquivalenceData, PackageData, SubstancePackage } from "@/lib/types"
import { cn } from "@/lib/utils"

const pageSize = 10

export function DashboardPage() {
  const initialAIC = useRef(normalizeAIC(new URLSearchParams(window.location.search).get("aic") ?? ""))
  const [query, setQuery] = useState(initialAIC.current)
  const [pkg, setPkg] = useState<PackageData | null>(null)
  const [equivalence, setEquivalence] = useState<EquivalenceData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [memberFilter, setMemberFilter] = useState("")
  const [page, setPage] = useState(1)
  const [relatedSubstance, setRelatedSubstance] = useState<{ id: string; name: string } | null>(null)
  const [relatedPackages, setRelatedPackages] = useState<SubstancePackage[]>([])
  const [relatedLoading, setRelatedLoading] = useState(false)
  const resultRef = useRef<HTMLElement>(null)
  const relatedRequestRef = useRef(0)

  const filteredMembers = useMemo(() => {
    const needle = memberFilter.toLocaleLowerCase("it").trim()
    if (!equivalence) return []
    if (!needle) return equivalence.members
    return equivalence.members.filter((member) => `${member.name} ${member.aic} ${member.description}`.toLocaleLowerCase("it").includes(needle))
  }, [equivalence, memberFilter])

  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / pageSize))
  const visibleMembers = filteredMembers.slice((page - 1) * pageSize, page * pageSize)
  const referencePrice = equivalence?.reference_prices.find((price) => price.kind === "REFERENCE_PRICE")

  useEffect(() => setPage(1), [memberFilter, equivalence])

  const search = useCallback(async (aicValue: string) => {
    const aic = normalizeAIC(aicValue)
    if (aic.length !== 9) {
      const message = "Inserisci un codice AIC/MINSAN di 9 cifre."
      setError(message)
      toast.error("Codice non valido", { description: message })
      return
    }

    setLoading(true)
    setError("")
    setPkg(null)
    setEquivalence(null)
    setMemberFilter("")
    setRelatedSubstance(null)
    setRelatedPackages([])
    setRelatedLoading(false)
    const relatedRequest = ++relatedRequestRef.current
    try {
      const packageResponse = await getPackageByAIC(aic)
      setPkg(packageResponse.data)
      const relatedDecision = selectRelatedResults(packageResponse.data)
      const substance = relatedDecision.substance
      if (substance) {
        setRelatedSubstance({ id: substance.id, name: substance.name })
        setRelatedLoading(true)
        void getPackagesByActiveSubstance(substance.id)
          .then((packages) => {
            if (relatedRequestRef.current !== relatedRequest) return
            const uniquePackages = Array.from(new Map(packages.filter((item) => item.aic !== aic).map((item) => [item.aic, item])).values())
            setRelatedPackages(uniquePackages)
          })
          .catch(() => {
            if (relatedRequestRef.current === relatedRequest) setRelatedPackages([])
          })
          .finally(() => {
            if (relatedRequestRef.current === relatedRequest) setRelatedLoading(false)
          })
      }
      if (packageResponse.data.transparency_group ?? packageResponse.data.official_equivalence) {
        const equivalentResponse = await getOfficialEquivalents(packageResponse.data.id)
        setEquivalence(equivalentResponse.data)
      }
      window.requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))
    } catch (cause) {
      const technicalMessage = cause instanceof Error ? cause.message : ""
      const notFound = /not found|no package|resource/i.test(technicalMessage)
      const message = notFound
        ? `Nessuna confezione trovata per il codice AIC/MINSAN ${aic}.`
        : "Non è stato possibile recuperare la confezione. Riprova tra poco."
      setError(message)
      toast.error(notFound ? "Farmaco non trovato" : "Servizio non disponibile", { description: message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!initialAIC.current) return
    void search(initialAIC.current)
    initialAIC.current = ""
  }, [search])

  function submit(event: FormEvent) {
    event.preventDefault()
    void search(query)
  }

  return (
    <>
      <section className="relative overflow-hidden px-5 pb-16 pt-16 sm:pt-20 lg:px-8 lg:pb-24 lg:pt-28">
        <div className="hero-orb hero-orb-one" />
        <div className="hero-orb hero-orb-two" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_.95fr] lg:gap-16">
          <div className="max-w-2xl">
            <Badge variant="secondary" className="border-0">
              <Sparkle size={13} weight="fill" /> Dati pubblici sui medicinali
            </Badge>
            <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.04] tracking-[-0.045em] sm:text-6xl lg:text-[68px]">
              Cerca un farmaco <span className="text-primary">tramite codice AIC/MINSAN.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              Consulta confezioni, principi attivi e raggruppamenti osservati nella Lista di trasparenza AIFA.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
              <TrustPoint>159.858 confezioni</TrustPoint>
              <TrustPoint>1.006 raggruppamenti osservati</TrustPoint>
              <TrustPoint>Consultazione gratuita</TrustPoint>
            </div>
          </div>

          <Card className="relative overflow-hidden bg-card/95 shadow-md">
            <div className="h-1.5 bg-primary" />
            <CardContent className="p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-display text-xl font-semibold tracking-tight">Inserisci il codice AIC/MINSAN</p>
                </div>
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Fingerprint size={21} /></span>
              </div>
              <form onSubmit={submit} className="mt-7 space-y-3">
                <label htmlFor="aic-search" className="sr-only">Codice AIC/MINSAN</label>
                <div className="relative">
                  <MagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={19} />
                  <Input
                    id="aic-search"
                    value={query}
                    onChange={(event) => setQuery(normalizeAIC(event.target.value))}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="es. 012745093"
                    className="h-14 rounded-xl pl-12 pr-4 font-mono text-base tracking-wider"
                  />
                </div>
                <Button type="submit" className="h-12 w-full cursor-pointer rounded-xl" disabled={loading || query.length === 0}>
                  {loading ? "Ricerca in corso…" : "Apri la scheda"}
                  {!loading && <ArrowRight size={17} />}
                </Button>
              </form>
              <p className="mt-4 text-center text-sm text-muted-foreground">Non conosci il codice? <a href="/search" className="font-medium text-primary underline-offset-4 hover:underline">Cerca per nome</a></p>
              <p className="mt-3 text-center text-xs text-muted-foreground">La ricerca non fornisce indicazioni terapeutiche o di sostituzione.</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section ref={resultRef} className="scroll-mt-28 px-5 py-14 lg:px-8 lg:py-20" aria-live="polite">
        <div className="mx-auto max-w-7xl">
          <SafetyNotice className="mb-8" />
          {error && <Alert className="mx-auto max-w-3xl">{error}</Alert>}
          {loading && <PackageSkeleton />}
          {!loading && !pkg && !error && <EmptyResult />}
          {!loading && pkg && (
            <>
              <PackageHeader pkg={pkg} />

              <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Metric icon={<Flask size={19} />} label="Principi attivi" value={String(pkg.active_substances.length)} detail={pkg.active_substances.map((item) => item.name).join(" · ") || "Non disponibile"} />
                <Metric icon={<Database size={19} />} label="Classificazione ATC" value={pkg.atc[0]?.code ?? "—"} detail={pkg.atc[0]?.description ?? "Non disponibile"} />
                <Metric icon={<Package size={19} />} label="Regime di fornitura" value={pkg.supply_regime ?? "—"} detail={pkg.pharmaceutical_form?.name ?? "Non disponibile"} />
                <Metric icon={<ShieldCheck size={19} />} label="Raggruppamento lista" value={(pkg.transparency_group ?? pkg.official_equivalence)?.source_group_identifier ?? "—"} detail={(pkg.transparency_group ?? pkg.official_equivalence)?.label ?? "Nessun raggruppamento nello snapshot corrente"} accent />
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_.65fr]">
                <Card>
                  <CardContent className="p-6 sm:p-7">
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 place-items-center rounded-xl bg-secondary text-secondary-foreground"><Flask size={20} /></span>
                      <div><h3 className="font-display text-lg font-semibold">Composizione e confezione</h3><p className="text-sm text-muted-foreground">Principi attivi e caratteristiche della confezione.</p></div>
                    </div>
                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                      {pkg.active_substances.length > 0 ? pkg.active_substances.map((ingredient) => (
                        <div key={ingredient.id} className="rounded-xl border bg-muted/25 p-4">
                          <p className="font-medium">{ingredient.name}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{[ingredient.quantity_raw, ingredient.unit_raw].filter(Boolean).join(" ") || "Dosaggio non disponibile"}</p>
                        </div>
                      )) : <p className="text-sm text-muted-foreground">Principi attivi non disponibili per questa confezione.</p>}
                    </div>
                    <dl className="mt-6 grid gap-x-8 gap-y-5 border-t pt-6 sm:grid-cols-2">
                      <Detail label="Titolare AIC" value={pkg.authorization_holder?.name} />
                      <Detail label="Forma farmaceutica" value={pkg.pharmaceutical_form?.name} />
                      <Detail label="Stato amministrativo" value={pkg.administrative_status} />
                      <Detail label="Fornitura" value={pkg.supply_regime} />
                    </dl>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6 sm:p-7">
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 place-items-center rounded-xl bg-secondary text-secondary-foreground"><Clock size={20} /></span>
                      <div><h3 className="font-display text-lg font-semibold">Aggiornamento dati</h3><p className="text-sm text-muted-foreground">Ultimo aggiornamento disponibile.</p></div>
                    </div>
                    <div className="mt-6 rounded-xl bg-muted/55 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Fonte ufficiale</p>
                      <p className="mt-1.5 font-medium">{friendlySourceName(pkg.provenance?.[0]?.source)}</p>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">Dati aggiornati il {formatFriendlyDate(pkg.observed_at)}.</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {equivalence && (
                <section className="mt-14" aria-labelledby="transparency-group-title">
                  <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
                    <div>
                      <p className="eyebrow">Lista di trasparenza AIFA</p>
                      <h2 id="transparency-group-title" className="mt-2 font-display text-3xl font-semibold tracking-[-0.03em]">Confezioni nello stesso raggruppamento</h2>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Gruppo <span className="font-mono font-semibold text-foreground">{equivalence.group_source_identifier}</span> · {equivalence.group_label}</p>
                    </div>
                    <div className="flex gap-8">
                      <SummaryNumber value={String(equivalence.members.length)} label="confezioni" />
                      <SummaryNumber value={referencePrice ? `${Number(referencePrice.amount).toFixed(2)} €` : "—"} label="limite di rimborso SSN pubblicato" />
                    </div>
                  </div>

                  <Card className="mt-7 overflow-hidden">
                    <div className="flex flex-col gap-4 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                      <div><p className="font-medium">Membri del raggruppamento nello snapshot</p><p className="mt-1 text-xs text-muted-foreground">La co-appartenenza è un dato documentale e non sostituisce la valutazione del farmacista.</p></div>
                      <div className="relative w-full sm:w-80">
                        <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                        <label htmlFor="member-filter" className="sr-only">Filtra i membri del raggruppamento</label>
                        <Input id="member-filter" className="h-10 pl-9" placeholder="Filtra le confezioni" value={memberFilter} onChange={(event) => setMemberFilter(event.target.value)} />
                      </div>
                    </div>
                    <Table>
                      <TableHeader><TableRow><TableHead>Medicinale</TableHead><TableHead>AIC/MINSAN</TableHead><TableHead className="hidden lg:table-cell">Confezione</TableHead><TableHead className="w-14"><span className="sr-only">Apri</span></TableHead></TableRow></TableHeader>
                      <TableBody>
                        {visibleMembers.map((member) => (
                          <TableRow key={member.id}>
                            <TableCell className="font-medium">{member.name}</TableCell>
                            <TableCell className="font-mono text-xs tracking-wide">{member.aic}</TableCell>
                            <TableCell className="hidden max-w-xl text-muted-foreground lg:table-cell">{member.description}</TableCell>
                            <TableCell><Button variant="ghost" size="icon" className="cursor-pointer" aria-label={`Apri ${member.name}, AIC ${member.aic}`} onClick={() => { setQuery(member.aic); void search(member.aic) }}><ArrowRight size={16} /></Button></TableCell>
                          </TableRow>
                        ))}
                        {visibleMembers.length === 0 && <TableRow><TableCell colSpan={4} className="py-12 text-center text-muted-foreground">Nessuna confezione corrisponde al filtro.</TableCell></TableRow>}
                      </TableBody>
                    </Table>
                    <ResultsPagination page={page} totalPages={totalPages} totalItems={filteredMembers.length} onPageChange={setPage} />
                  </Card>
                </section>
              )}

              {relatedSubstance && (
                <SameSubstanceSection
                  key={relatedSubstance.id}
                  substance={relatedSubstance}
                  packages={relatedPackages}
                  loading={relatedLoading}
                  onSelect={(aic) => {
                    setQuery(aic)
                    void search(aic)
                  }}
                />
              )}
            </>
          )}
        </div>
      </section>
    </>
  )
}

function TrustPoint({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-2"><CheckCircle className="text-primary" size={16} weight="fill" />{children}</span>
}

function SameSubstanceSection({ substance, packages, loading, onSelect }: { substance: { id: string; name: string }; packages: SubstancePackage[]; loading: boolean; onSelect: (aic: string) => void }) {
  const [filter, setFilter] = useState("")
  const [compositionFilter, setCompositionFilter] = useState("all")
  const [dosageFilter, setDosageFilter] = useState("all")
  const [formFilter, setFormFilter] = useState("all")
  const [officialFilter, setOfficialFilter] = useState("all")
  const [relatedPage, setRelatedPage] = useState(1)

  const relatedFilters = useMemo<RelatedFilters>(() => ({
    needle: filter.trim().toLocaleLowerCase("it"),
    composition: compositionFilter,
    dosage: dosageFilter,
    form: formFilter,
    official: officialFilter,
  }), [compositionFilter, dosageFilter, filter, formFilter, officialFilter])

  const dosageOptions = useMemo(() => {
    const options = new Map<string, { label: string; sortValue: number }>()
    for (const item of packages) {
      const dosage = packageDosage(item)
      if (!dosage) continue
      options.set(dosage.key, { label: dosage.label, sortValue: dosage.sortValue })
    }
    return Array.from(options, ([key, value]) => ({ key, ...value })).sort((left, right) => left.sortValue - right.sortValue || left.label.localeCompare(right.label, "it"))
  }, [packages])

  const dosageFacets = useMemo(() => dosageOptions.map((option) => ({
    ...option,
    count: packages.filter((item) => matchesRelatedFilters(item, relatedFilters, "dosage") && packageDosage(item)?.key === option.key).length,
  })), [dosageOptions, packages, relatedFilters])

  const formOptions = useMemo(() => Array.from(new Set(packages.map((item) => item.pharmaceutical_form).filter((value): value is string => Boolean(value)))).sort((left, right) => left.localeCompare(right, "it")), [packages])

  const formFacets = useMemo(() => formOptions.map((name) => ({
    name,
    count: packages.filter((item) => matchesRelatedFilters(item, relatedFilters, "form") && item.pharmaceutical_form === name).length,
  })), [formOptions, packages, relatedFilters])

  const compositionBase = useMemo(() => packages.filter((item) => matchesRelatedFilters(item, relatedFilters, "composition")), [packages, relatedFilters])
  const officialBase = useMemo(() => packages.filter((item) => matchesRelatedFilters(item, relatedFilters, "official")), [packages, relatedFilters])
  const dosageBaseCount = useMemo(() => packages.filter((item) => matchesRelatedFilters(item, relatedFilters, "dosage")).length, [packages, relatedFilters])
  const formBaseCount = useMemo(() => packages.filter((item) => matchesRelatedFilters(item, relatedFilters, "form")).length, [packages, relatedFilters])

  const filteredPackages = useMemo(() => packages.filter((item) => matchesRelatedFilters(item, relatedFilters)), [packages, relatedFilters])
  const singleIngredientCount = compositionBase.filter((item) => item.ingredient_count === 1).length
  const combinationCount = compositionBase.filter((item) => item.ingredient_count > 1).length
  const officialCount = officialBase.filter((item) => item.in_official_list).length
  const outsideOfficialCount = officialBase.length - officialCount

  const totalPages = Math.max(1, Math.ceil(filteredPackages.length / pageSize))
  const visiblePackages = filteredPackages.slice((relatedPage - 1) * pageSize, relatedPage * pageSize)
  const activeFilterCount = [compositionFilter, dosageFilter, formFilter, officialFilter].filter((value) => value !== "all").length + (filter.trim() ? 1 : 0)

  useEffect(() => setRelatedPage(1), [compositionFilter, dosageFilter, filter, formFilter, officialFilter, packages])

  function resetFilters() {
    setFilter("")
    setCompositionFilter("all")
    setDosageFilter("all")
    setFormFilter("all")
    setOfficialFilter("all")
  }

  return (
    <section className="mt-14" aria-labelledby="same-substance-title">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <p className="eyebrow">Confronto descrittivo della composizione</p>
          <h2 id="same-substance-title" className="mt-2 font-display text-3xl font-semibold tracking-[-0.03em]">Confezioni che riportano {substance.name.toLocaleLowerCase("it")}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">La presenza dello stesso principio attivo non dimostra equivalenza, intercambiabilità o appropriatezza per una persona. Dosaggio, forma, via di somministrazione ed eccipienti possono differire.</p>
        </div>
        {!loading && <SummaryNumber value={String(filteredPackages.length)} label={activeFilterCount > 0 ? "risultati" : "altre confezioni"} />}
      </div>

      <Card className="mt-7 overflow-hidden">
        <div className="flex flex-col gap-4 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div><p className="font-medium">Confezioni contenenti il principio attivo</p><p className="mt-1 text-xs text-muted-foreground">Elenco descrittivo, non elenco di alternative terapeutiche.</p></div>
          <div className="relative w-full sm:w-80">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <label htmlFor="related-filter" className="sr-only">Filtra i farmaci con lo stesso principio attivo</label>
            <Input id="related-filter" className="h-10 pl-9" placeholder="Filtra per nome o AIC" value={filter} onChange={(event) => setFilter(event.target.value)} disabled={loading} />
          </div>
        </div>

        <div className="border-b bg-muted/20 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="inline-flex items-center gap-2 text-sm font-medium"><FunnelSimple size={17} /> Filtri {activeFilterCount > 0 && <Badge variant="secondary">{activeFilterCount}</Badge>}</p>
            <Button variant="outline" size="sm" className="cursor-pointer bg-background" onClick={resetFilters} disabled={activeFilterCount === 0}><X size={15} /> Azzera filtri</Button>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <FacetSelect label="Composizione" value={compositionFilter} selectedLabel={compositionFilter === "single" ? `Solo ${substance.name.toLocaleLowerCase("it")}` : compositionFilter === "combination" ? "In associazione" : "Tutte le composizioni"} onValueChange={setCompositionFilter}>
              <SelectItem value="all">Tutte le composizioni ({compositionBase.length})</SelectItem>
              <SelectItem value="single" disabled={singleIngredientCount === 0 && compositionFilter !== "single"}>Solo {substance.name.toLocaleLowerCase("it")} ({singleIngredientCount})</SelectItem>
              <SelectItem value="combination" disabled={combinationCount === 0 && compositionFilter !== "combination"}>In associazione ({combinationCount})</SelectItem>
            </FacetSelect>
            <FacetSelect label="Dosaggio" value={dosageFilter} selectedLabel={dosageFilter === "all" ? "Tutti i dosaggi" : dosageFacets.find((item) => item.key === dosageFilter)?.label ?? "Dosaggio"} onValueChange={setDosageFilter}>
              <SelectItem value="all">Tutti i dosaggi ({dosageBaseCount})</SelectItem>
              {dosageFacets.map((item) => <SelectItem key={item.key} value={item.key} disabled={item.count === 0 && dosageFilter !== item.key}>{item.label} ({item.count})</SelectItem>)}
            </FacetSelect>
            <FacetSelect label="Forma" value={formFilter} selectedLabel={formFilter === "all" ? "Tutte le forme" : formFilter} onValueChange={setFormFilter}>
              <SelectItem value="all">Tutte le forme ({formBaseCount})</SelectItem>
              {formFacets.map((item) => <SelectItem key={item.name} value={item.name} disabled={item.count === 0 && formFilter !== item.name}>{item.name} ({item.count})</SelectItem>)}
            </FacetSelect>
            <FacetSelect label="Lista di trasparenza" value={officialFilter} selectedLabel={officialFilter === "official" ? "Incluse nella lista" : officialFilter === "outside" ? "Non incluse nella lista" : "Tutte le confezioni"} onValueChange={setOfficialFilter}>
              <SelectItem value="all">Tutte le confezioni ({officialBase.length})</SelectItem>
              <SelectItem value="official" disabled={officialCount === 0 && officialFilter !== "official"}>Incluse nella lista ({officialCount})</SelectItem>
              <SelectItem value="outside" disabled={outsideOfficialCount === 0 && officialFilter !== "outside"}>Non incluse nella lista ({outsideOfficialCount})</SelectItem>
            </FacetSelect>
          </div>
        </div>
        {loading ? <RelatedPackagesSkeleton /> : (
          <>
            <div className="grid gap-3 p-4 md:hidden">
              {visiblePackages.map((item) => (
                <article key={item.id} className="rounded-xl border bg-background p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="font-medium">{item.name}</p><p className="mt-1 font-mono text-xs text-muted-foreground">AIC/MINSAN {item.aic}</p></div>
                    <Button variant="ghost" size="icon" className="shrink-0 cursor-pointer" aria-label={`Apri ${item.name}, AIC/MINSAN ${item.aic}`} onClick={() => onSelect(item.aic)}><ArrowRight size={16} /></Button>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.description}</p>
                </article>
              ))}
            </div>

            <div className="hidden md:block">
              <Table>
                <TableHeader><TableRow><TableHead>Medicinale</TableHead><TableHead>AIC/MINSAN</TableHead><TableHead className="hidden lg:table-cell">Confezione</TableHead><TableHead className="w-14"><span className="sr-only">Apri</span></TableHead></TableRow></TableHeader>
                <TableBody>
                  {visiblePackages.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="font-mono text-xs tracking-wide">{item.aic}</TableCell>
                      <TableCell className="hidden max-w-xl text-muted-foreground lg:table-cell">{item.description}</TableCell>
                      <TableCell><Button variant="ghost" size="icon" className="cursor-pointer" aria-label={`Apri ${item.name}, AIC/MINSAN ${item.aic}`} onClick={() => onSelect(item.aic)}><ArrowRight size={16} /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {visiblePackages.length === 0 && <p className="px-4 py-12 text-center text-sm text-muted-foreground">Nessuna confezione soddisfa tutti i filtri selezionati.</p>}
            <ResultsPagination page={relatedPage} totalPages={totalPages} totalItems={filteredPackages.length} onPageChange={setRelatedPage} targetId="same-substance-title" />
          </>
        )}
      </Card>
    </section>
  )
}

function FacetSelect({ label, value, selectedLabel, onValueChange, children }: { label: string; value: string; selectedLabel: string; onValueChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      <Select value={value} onValueChange={(nextValue) => { if (nextValue) onValueChange(nextValue) }}>
        <SelectTrigger className="h-10 w-full cursor-pointer"><SelectValue>{selectedLabel}</SelectValue></SelectTrigger>
        <SelectContent align="start">{children}</SelectContent>
      </Select>
    </div>
  )
}

type RelatedFacet = "composition" | "dosage" | "form" | "official"

type RelatedFilters = {
  needle: string
  composition: string
  dosage: string
  form: string
  official: string
}

function matchesRelatedFilters(item: SubstancePackage, filters: RelatedFilters, ignoredFacet?: RelatedFacet) {
  if (filters.needle && !`${item.name} ${item.aic} ${item.description}`.toLocaleLowerCase("it").includes(filters.needle)) return false
  if (ignoredFacet !== "composition") {
    if (filters.composition === "single" && item.ingredient_count !== 1) return false
    if (filters.composition === "combination" && item.ingredient_count <= 1) return false
  }
  if (ignoredFacet !== "dosage" && filters.dosage !== "all" && packageDosage(item)?.key !== filters.dosage) return false
  if (ignoredFacet !== "form" && filters.form !== "all" && item.pharmaceutical_form !== filters.form) return false
  if (ignoredFacet !== "official") {
    if (filters.official === "official" && !item.in_official_list) return false
    if (filters.official === "outside" && item.in_official_list) return false
  }
  return true
}

function packageDosage(item: SubstancePackage) {
  const quantity = item.quantity ?? parseLocalizedNumber(item.quantity_raw)
  const unit = normalizeDosageUnit(nonEmptyString(item.unit) ?? item.unit_raw)
  if (quantity === null || !unit) return null
  const formattedQuantity = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 6 }).format(quantity)
  return { key: `${quantity}|${unit}`, label: `${formattedQuantity} ${unit}`, sortValue: quantity }
}

function parseLocalizedNumber(value?: string | null) {
  if (!value?.trim()) return null
  const parsed = Number(value.trim().replace(",", "."))
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeDosageUnit(value?: string | null) {
  if (!value?.trim()) return null
  return value.trim().toLocaleLowerCase("it")
    .replace(/milligram\(s\)\/millilitre/g, "mg/ml")
    .replace(/milligrammi\/millilitr[io]/g, "mg/ml")
    .replace(/microgramm[io]/g, "mcg")
    .replace(/milligramm[io]/g, "mg")
    .replace(/millilitr[io]/g, "ml")
    .replace(/gramm[io]/g, "g")
    .replace(/\s+/g, "")
}

function nonEmptyString(value?: string | null) {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function RelatedPackagesSkeleton() {
  return <div className="space-y-3 p-4 sm:p-5">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-20 w-full" />)}</div>
}

function PackageHeader({ pkg }: { pkg: PackageData }) {
  return (
    <div className="flex flex-col justify-between gap-5 border-b pb-7 md:flex-row md:items-end">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-mono tracking-wider">AIC/MINSAN {pkg.aic}</Badge>
          {pkg.administrative_status && <Badge variant="secondary" className="bg-success/10 text-success"><CheckCircle size={13} weight="fill" /> {pkg.administrative_status}</Badge>}
        </div>
        <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">{pkg.medicine.name}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">{pkg.package_description}</p>
      </div>
      <a href={`/compare?aic=${encodeURIComponent(pkg.aic)}`} className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors duration-200 hover:bg-muted">Confronta questo AIC/MINSAN <ArrowRight size={15} /></a>
    </div>
  )
}

function Metric({ icon, label, value, detail, accent = false }: { icon: React.ReactNode; label: string; value: string; detail: string; accent?: boolean }) {
  return (
    <Card className={cn("overflow-hidden", accent && "border-accent-foreground/30 bg-accent/35")}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p><span className={accent ? "text-accent-foreground" : "text-primary"}>{icon}</span></div>
        <p className="mt-4 break-words font-display text-xl font-semibold leading-6 tracking-tight sm:text-2xl sm:leading-7">{value}</p>
        <p className="mt-2 min-h-10 break-words text-xs leading-5 text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  )
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return <div><dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</dt><dd className="mt-1.5 text-sm font-medium leading-5">{value || "Non disponibile"}</dd></div>
}

function SummaryNumber({ value, label }: { value: string; label: string }) {
  return <div><p className="font-display text-2xl font-semibold tracking-tight">{value}</p><p className="mt-0.5 text-xs text-muted-foreground">{label}</p></div>
}

function EmptyResult() {
  return (
    <Empty className="mx-auto max-w-xl py-10">
      <EmptyHeader>
        <EmptyMedia variant="icon"><MagnifyingGlass size={20} /></EmptyMedia>
        <EmptyTitle className="font-display text-xl">Cerca un medicinale</EmptyTitle>
        <EmptyDescription>Cerca una confezione tramite codice AIC/MINSAN oppure usa la ricerca per nome.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

function ResultsPagination({ page, totalPages, totalItems, onPageChange, targetId = "transparency-group-title" }: { page: number; totalPages: number; totalItems: number; onPageChange: (page: number) => void; targetId?: string }) {
  if (totalPages <= 1) return null
  const first = (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, totalItems)

  return (
    <div className="flex flex-col gap-3 border-t px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p className="text-xs text-muted-foreground" aria-live="polite">Risultati {first}–{last} di {totalItems}</p>
      <Pagination className="mx-0 w-auto justify-start sm:justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious href={`#${targetId}`} text="Precedente" aria-disabled={page === 1} className={cn(page === 1 && "pointer-events-none opacity-50")} onClick={(event) => { event.preventDefault(); if (page > 1) onPageChange(page - 1) }} />
          </PaginationItem>
          <PaginationItem><span className="flex h-8 min-w-24 items-center justify-center px-2 text-xs font-medium">Pagina {page} di {totalPages}</span></PaginationItem>
          <PaginationItem>
            <PaginationNext href={`#${targetId}`} text="Successiva" aria-disabled={page === totalPages} className={cn(page === totalPages && "pointer-events-none opacity-50")} onClick={(event) => { event.preventDefault(); if (page < totalPages) onPageChange(page + 1) }} />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )
}

function PackageSkeleton() {
  return <div className="space-y-7"><div><Skeleton className="h-6 w-36" /><Skeleton className="mt-4 h-12 w-72 max-w-full" /><Skeleton className="mt-3 h-5 w-full max-w-2xl" /></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-36" />)}</div><div className="grid gap-6 lg:grid-cols-[1.35fr_.65fr]"><Skeleton className="h-80" /><Skeleton className="h-80" /></div></div>
}

function formatFriendlyDate(value?: string) {
  if (!value) return "non disponibile"
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "long" }).format(new Date(value))
}

function friendlySourceName(source?: string) {
  const names: Record<string, string> = {
    "aifa-packages": "Anagrafica confezioni AIFA",
    "aifa-transparency-list": "Lista di trasparenza AIFA",
  }
  return names[source ?? ""] ?? "Agenzia Italiana del Farmaco"
}
