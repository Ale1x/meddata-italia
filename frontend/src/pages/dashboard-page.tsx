import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowRight,
  ArrowUpRight,
  CaretDown,
  CheckCircle,
  Clock,
  Database,
  Fingerprint,
  Flask,
  MagnifyingGlass,
  Package,
  Pill,
  ShieldCheck,
  Sparkle,
} from "@phosphor-icons/react"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { getOfficialEquivalents, getPackageByAIC, normalizeAIC } from "@/lib/api"
import { commonMedicines, type CommonMedicine } from "@/lib/common-medicines"
import type { EquivalenceData, PackageData } from "@/lib/types"
import { cn } from "@/lib/utils"

const pageSize = 10

export function DashboardPage() {
  const [query, setQuery] = useState("")
  const [pkg, setPkg] = useState<PackageData | null>(null)
  const [equivalence, setEquivalence] = useState<EquivalenceData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [memberFilter, setMemberFilter] = useState("")
  const [page, setPage] = useState(1)
  const resultRef = useRef<HTMLElement>(null)

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

  async function search(aicValue: string) {
    const aic = normalizeAIC(aicValue)
    if (!aic) return

    setLoading(true)
    setError("")
    setPkg(null)
    setEquivalence(null)
    setMemberFilter("")
    try {
      const packageResponse = await getPackageByAIC(aic)
      setPkg(packageResponse.data)
      if (packageResponse.data.official_equivalence) {
        const equivalentResponse = await getOfficialEquivalents(packageResponse.data.id)
        setEquivalence(equivalentResponse.data)
      }
      window.requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Non è stato possibile recuperare la confezione.")
    } finally {
      setLoading(false)
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    void search(query)
  }

  function selectMedicine(medicine: CommonMedicine) {
    setQuery(medicine.aic)
    void search(medicine.aic)
  }

  return (
    <>
      <section className="relative overflow-hidden px-5 pb-16 pt-16 sm:pt-20 lg:px-8 lg:pb-24 lg:pt-28">
        <div className="hero-orb hero-orb-one" />
        <div className="hero-orb hero-orb-two" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_.95fr] lg:gap-16">
          <div className="max-w-2xl">
            <Badge variant="secondary" className="border-0">
              <Sparkle size={13} weight="fill" /> Dataset ufficiali AIFA
            </Badge>
            <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.04] tracking-[-0.045em] sm:text-6xl lg:text-[68px]">
              Un codice. <span className="text-primary">Tutto il farmaco.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              Cerca una confezione tramite AIC e consulta composizione, classificazione e appartenenza ai gruppi ufficiali della lista di trasparenza.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
              <TrustPoint>159.858 confezioni</TrustPoint>
              <TrustPoint>1.006 gruppi ufficiali</TrustPoint>
              <TrustPoint>AIC preservato a 9 cifre</TrustPoint>
            </div>
          </div>

          <Card className="relative overflow-hidden bg-card/95 shadow-[var(--shadow-elevated)]">
            <div className="h-1.5 bg-primary" />
            <CardContent className="p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-display text-xl font-semibold tracking-tight">Cerca per codice AIC</p>
                  <p className="mt-1 text-sm text-muted-foreground">Inserisci da 1 a 9 cifre. Gli zeri iniziali vengono normalizzati.</p>
                </div>
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Fingerprint size={21} /></span>
              </div>
              <form onSubmit={submit} className="mt-7 space-y-3">
                <label htmlFor="aic-search" className="sr-only">Codice AIC</label>
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
              <p className="mt-4 text-center text-xs text-muted-foreground">Nessun suggerimento terapeutico. Solo consultazione dei dati pubblicati.</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="border-y bg-muted/35 px-5 py-14 lg:px-8 lg:py-18">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="eyebrow">Accesso rapido</p>
              <h2 className="mt-2 font-display text-3xl font-semibold tracking-[-0.03em]">Farmaci comuni</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Confezioni note selezionate come esempi di ricerca. I codici sono stati verificati su fonti pubbliche istituzionali.</p>
            </div>
            <p className="max-w-xs text-xs leading-5 text-muted-foreground">La presenza in questa sezione non costituisce una raccomandazione d’uso.</p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {commonMedicines.map((medicine) => <CommonMedicineCard key={medicine.aic} medicine={medicine} onSelect={() => selectMedicine(medicine)} />)}
          </div>
        </div>
      </section>

      <section ref={resultRef} className="scroll-mt-28 px-5 py-14 lg:px-8 lg:py-20" aria-live="polite">
        <div className="mx-auto max-w-7xl">
          {error && <Alert className="mx-auto max-w-3xl">{error}</Alert>}
          {loading && <PackageSkeleton />}
          {!loading && !pkg && !error && <EmptyResult />}
          {!loading && pkg && (
            <>
              <PackageHeader pkg={pkg} />

              <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Metric icon={<Flask size={19} />} label="Principi attivi" value={String(pkg.active_substances.length)} detail={pkg.active_substances.map((item) => item.name).join(" · ") || "Non strutturati"} />
                <Metric icon={<Database size={19} />} label="Classificazione ATC" value={pkg.atc[0]?.code ?? "—"} detail={pkg.atc[0]?.description ?? "Non disponibile"} />
                <Metric icon={<Package size={19} />} label="Regime di fornitura" value={pkg.supply_regime ?? "—"} detail={pkg.pharmaceutical_form?.name ?? "Forma non strutturata"} />
                <Metric icon={<ShieldCheck size={19} />} label="Gruppo ufficiale" value={pkg.official_equivalence?.source_group_identifier ?? "—"} detail={pkg.official_equivalence?.label ?? "Fuori dalla lista di trasparenza"} accent />
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_.65fr]">
                <Card>
                  <CardContent className="p-6 sm:p-7">
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 place-items-center rounded-xl bg-secondary text-secondary-foreground"><Flask size={20} /></span>
                      <div><h3 className="font-display text-lg font-semibold">Composizione e confezione</h3><p className="text-sm text-muted-foreground">Campi normalizzati senza completamenti inferiti.</p></div>
                    </div>
                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                      {pkg.active_substances.length > 0 ? pkg.active_substances.map((ingredient) => (
                        <div key={ingredient.id} className="rounded-xl border bg-muted/25 p-4">
                          <p className="font-medium">{ingredient.name}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{[ingredient.quantity_raw, ingredient.unit_raw].filter(Boolean).join(" ") || "Dosaggio nella descrizione sorgente"}</p>
                        </div>
                      )) : <p className="text-sm text-muted-foreground">Principi attivi strutturati non disponibili per questa confezione.</p>}
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
                      <div><h3 className="font-display text-lg font-semibold">Aggiornamento dati</h3><p className="text-sm text-muted-foreground">Informazioni sull’ultima acquisizione.</p></div>
                    </div>
                    <div className="mt-6 rounded-xl bg-muted/55 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Fonte ufficiale</p>
                      <p className="mt-1.5 font-medium">{friendlySourceName(pkg.provenance?.[0]?.source)}</p>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">Dati aggiornati il {formatFriendlyDate(pkg.observed_at)}.</p>
                    </div>
                    <Collapsible className="mt-4 group/technical">
                      <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between rounded-lg px-2 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50">
                        Dettagli tecnici
                        <CaretDown size={16} className="transition-transform group-data-[open]/technical:rotate-180" />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="px-2 pb-1 pt-3 text-xs text-muted-foreground">
                        <dl className="space-y-3">
                          <TechnicalDetail label="ID sorgente" value={pkg.provenance?.[0]?.source ?? "aifa-packages"} />
                          <TechnicalDetail label="Rilevato" value={formatDate(pkg.observed_at)} />
                          <TechnicalDetail label="Hash SHA-256" value={shortHash(pkg.provenance?.[0]?.artifact_hash)} mono />
                        </dl>
                      </CollapsibleContent>
                    </Collapsible>
                  </CardContent>
                </Card>
              </div>

              {equivalence && (
                <section className="mt-14" aria-labelledby="equivalents-title">
                  <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
                    <div>
                      <p className="eyebrow">Lista di trasparenza AIFA</p>
                      <h2 id="equivalents-title" className="mt-2 font-display text-3xl font-semibold tracking-[-0.03em]">Equivalenti ufficiali</h2>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Gruppo <span className="font-mono font-semibold text-foreground">{equivalence.group_source_identifier}</span> · {equivalence.group_label}</p>
                    </div>
                    <div className="flex gap-8">
                      <SummaryNumber value={String(equivalence.members.length)} label="confezioni" />
                      <SummaryNumber value={referencePrice ? `${Number(referencePrice.amount).toFixed(2)} €` : "—"} label="prezzo riferimento" />
                    </div>
                  </div>

                  <Card className="mt-7 overflow-hidden">
                    <div className="flex flex-col gap-4 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                      <div><p className="font-medium">Tutte le confezioni del gruppo</p><p className="mt-1 text-xs text-muted-foreground">Naviga pagina per pagina oppure filtra per nome, AIC o descrizione.</p></div>
                      <div className="relative w-full sm:w-80">
                        <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                        <label htmlFor="member-filter" className="sr-only">Filtra gli equivalenti</label>
                        <Input id="member-filter" className="h-10 pl-9" placeholder="Filtra le confezioni" value={memberFilter} onChange={(event) => setMemberFilter(event.target.value)} />
                      </div>
                    </div>
                    <Table>
                      <TableHeader><TableRow><TableHead>Medicinale</TableHead><TableHead>AIC</TableHead><TableHead className="hidden lg:table-cell">Confezione</TableHead><TableHead className="w-14"><span className="sr-only">Apri</span></TableHead></TableRow></TableHeader>
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

const toneStyles: Record<CommonMedicine["tone"], string> = {
  blue: "bg-primary",
  lime: "bg-primary",
  amber: "bg-primary",
  violet: "bg-primary",
  rose: "bg-primary",
}

function CommonMedicineCard({ medicine, onSelect }: { medicine: CommonMedicine; onSelect: () => void }) {
  return (
    <article className="group flex min-h-56 flex-col rounded-2xl border bg-card p-5 transition-[border-color,box-shadow] duration-200 hover:border-primary/30 hover:shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between">
        <span className={cn("grid size-9 place-items-center rounded-xl text-primary-foreground", toneStyles[medicine.tone])}><Pill size={17} weight="fill" /></span>
        <Tooltip>
          <TooltipTrigger render={<a href={medicine.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex cursor-pointer items-center gap-1 text-[11px] text-muted-foreground transition-colors duration-200 hover:text-foreground" aria-label={`Apri la fonte per ${medicine.name}`} />}>Fonte <ArrowUpRight size={12} /></TooltipTrigger>
          <TooltipContent>{medicine.sourceLabel}</TooltipContent>
        </Tooltip>
      </div>
      <h3 className="mt-5 font-display text-xl font-semibold tracking-tight">{medicine.name}</h3>
      <p className="mt-1 text-xs font-medium text-muted-foreground">{medicine.activeSubstance}</p>
      <p className="mt-4 text-sm leading-5">{medicine.description}</p>
      <button onClick={onSelect} className="mt-auto flex cursor-pointer items-center justify-between border-t pt-4 text-left text-xs font-medium text-primary transition-colors duration-200 hover:text-primary/75">
        <span className="font-mono tracking-wide">AIC {medicine.aic}</span><ArrowRight size={15} />
      </button>
    </article>
  )
}

function PackageHeader({ pkg }: { pkg: PackageData }) {
  return (
    <div className="flex flex-col justify-between gap-5 border-b pb-7 md:flex-row md:items-end">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-mono tracking-wider">AIC {pkg.aic}</Badge>
          {pkg.administrative_status && <Badge variant="secondary"><CheckCircle size={13} weight="fill" /> {pkg.administrative_status}</Badge>}
        </div>
        <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">{pkg.medicine.name}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">{pkg.package_description}</p>
      </div>
      <a href="/compare" className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors duration-200 hover:bg-muted">Confronta questo AIC <ArrowRight size={15} /></a>
    </div>
  )
}

function Metric({ icon, label, value, detail, accent = false }: { icon: React.ReactNode; label: string; value: string; detail: string; accent?: boolean }) {
  return (
    <Card className={cn("overflow-hidden", accent && "border-primary/25")}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p><span className="text-primary">{icon}</span></div>
        <p className="mt-4 break-words font-display text-xl font-semibold leading-6 tracking-tight sm:text-2xl sm:leading-7">{value}</p>
        <p className="mt-2 min-h-10 break-words text-xs leading-5 text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  )
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return <div><dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</dt><dd className="mt-1.5 text-sm font-medium leading-5">{value || "Non disponibile"}</dd></div>
}

function TechnicalDetail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div><dt className="font-semibold uppercase tracking-[0.1em]">{label}</dt><dd className={cn("mt-1 break-all text-foreground", mono && "font-mono leading-5")}>{value}</dd></div>
}

function SummaryNumber({ value, label }: { value: string; label: string }) {
  return <div><p className="font-display text-2xl font-semibold tracking-tight">{value}</p><p className="mt-0.5 text-xs text-muted-foreground">{label}</p></div>
}

function EmptyResult() {
  return (
    <Empty className="mx-auto max-w-xl py-10">
      <EmptyHeader>
        <EmptyMedia variant="icon"><MagnifyingGlass size={20} /></EmptyMedia>
        <EmptyTitle className="font-display text-xl">Pronto per una ricerca</EmptyTitle>
        <EmptyDescription>Inserisci un AIC oppure scegli uno dei farmaci comuni. La scheda comparirà qui senza contenuti precompilati.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

function ResultsPagination({ page, totalPages, totalItems, onPageChange }: { page: number; totalPages: number; totalItems: number; onPageChange: (page: number) => void }) {
  if (totalPages <= 1) return null
  const first = (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, totalItems)

  return (
    <div className="flex flex-col gap-3 border-t px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p className="text-xs text-muted-foreground" aria-live="polite">Risultati {first}–{last} di {totalItems}</p>
      <Pagination className="mx-0 w-auto justify-start sm:justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious href="#equivalents-title" text="Precedente" aria-disabled={page === 1} className={cn(page === 1 && "pointer-events-none opacity-50")} onClick={(event) => { event.preventDefault(); if (page > 1) onPageChange(page - 1) }} />
          </PaginationItem>
          <PaginationItem><span className="flex h-8 min-w-24 items-center justify-center px-2 text-xs font-medium">Pagina {page} di {totalPages}</span></PaginationItem>
          <PaginationItem>
            <PaginationNext href="#equivalents-title" text="Successiva" aria-disabled={page === totalPages} className={cn(page === totalPages && "pointer-events-none opacity-50")} onClick={(event) => { event.preventDefault(); if (page < totalPages) onPageChange(page + 1) }} />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )
}

function PackageSkeleton() {
  return <div className="space-y-7"><div><Skeleton className="h-6 w-36" /><Skeleton className="mt-4 h-12 w-72 max-w-full" /><Skeleton className="mt-3 h-5 w-full max-w-2xl" /></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-36" />)}</div><div className="grid gap-6 lg:grid-cols-[1.35fr_.65fr]"><Skeleton className="h-80" /><Skeleton className="h-80" /></div></div>
}

function formatDate(value?: string) {
  if (!value) return "Non disponibile"
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
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

function shortHash(value?: string) {
  if (!value) return "Non disponibile"
  return `${value.slice(0, 14)}…${value.slice(-10)}`
}
