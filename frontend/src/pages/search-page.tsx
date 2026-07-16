import { type FormEvent, useEffect, useRef, useState } from "react"
import { ArrowLeft, ArrowRight, MagnifyingGlass, Package, Pill } from "@phosphor-icons/react"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SafetyNotice } from "@/components/safety-notice"
import { getMedicine, getPackageByAIC, searchMedicines } from "@/lib/api"
import type { MedicineData, MedicinePackage, MedicineSummary } from "@/lib/types"
import { cn } from "@/lib/utils"

const pageSize = 10

type SearchResult = {
  medicine: MedicineData
  activeSubstances: string[]
}

type SearchCandidate = {
  key: string
  name: string
  medicines: MedicineSummary[]
}

export function SearchPage() {
  const [query, setQuery] = useState("")
  const [matches, setMatches] = useState<SearchCandidate[]>([])
  const [result, setResult] = useState<SearchResult | null>(null)
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [searchingNames, setSearchingNames] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const resultRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!submitted || loading || (!result && !error)) return
    if (!window.matchMedia("(max-width: 767px)").matches) return
    window.requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))
  }, [error, loading, result, submitted])

  useEffect(() => {
    const value = query.trim()
    if (value.length < 2) {
      setMatches([])
      setSearchingNames(false)
      return
    }

    let active = true
    setSearchingNames(true)
    const timeout = window.setTimeout(async () => {
      try {
        const response = await searchMedicines(value, 50)
        if (active) setMatches(groupMedicineMatches(response.data))
      } catch {
        if (active) setMatches([])
      } finally {
        if (active) setSearchingNames(false)
      }
    }, 250)

    return () => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [query])

  async function selectMedicine(candidate: SearchCandidate) {
    setSubmitted(true)
    setLoading(true)
    setError("")
    setResult(null)
    setSuggestionsOpen(false)
    try {
      const responses = await Promise.all(candidate.medicines.map((medicine) => getMedicine(medicine.id)))
      const medicines = responses.map((response) => response.data)
      const firstMedicine = medicines[0]
      if (!firstMedicine) {
        setError("Nessun farmaco trovato.")
        return
      }
      const packages = Array.from(
        new Map(medicines.flatMap((medicine) => medicine.packages).map((item) => [item.aic, item])).values(),
      ).sort((left, right) => left.aic.localeCompare(right.aic))
      let activeSubstances: string[] = []
      const firstPackage = packages[0]
      if (firstPackage) {
        try {
          const packageResponse = await getPackageByAIC(firstPackage.aic)
          activeSubstances = packageResponse.data.active_substances.map((item) => item.name)
        } catch {
          // Package results remain usable if the ingredient lookup is temporarily unavailable.
        }
      }
      setResult({ medicine: { ...firstMedicine, name: candidate.name, packages }, activeSubstances })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Non è stato possibile recuperare il farmaco.")
    } finally {
      setLoading(false)
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const value = query.trim()
    if (!value) return
    setSubmitted(true)

    const exactMatch = matches.find((medicine) => medicine.name.localeCompare(value, "it", { sensitivity: "base" }) === 0)
    if (exactMatch) {
      await selectMedicine(exactMatch)
      return
    }

    setLoading(true)
    setError("")
    try {
      const response = await searchMedicines(value, 50)
      const firstMatch = groupMedicineMatches(response.data)[0]
      if (!firstMatch) {
        setResult(null)
        setError("Nessun farmaco trovato.")
        return
      }
      await selectMedicine(firstMatch)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Non è stato possibile cercare il farmaco.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="px-5 pb-10 pt-14 sm:pt-18 lg:px-8 lg:pt-22">
      <div className="mx-auto max-w-6xl">
        <a href="/" className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft size={16} /> Torna al catalogo</a>

        <div className="mt-8 max-w-3xl">
          <Badge variant="secondary"><MagnifyingGlass size={13} /> Consultazione per nome</Badge>
          <h1 className="mt-5 font-display text-4xl font-semibold leading-tight tracking-[-0.045em] sm:text-6xl">Consulta medicinali e <span className="text-primary">confezioni registrate.</span></h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">Cerca una denominazione per visualizzare i codici AIC/MINSAN e i dati descrittivi disponibili.</p>
        </div>

        <SafetyNotice compact className="mt-8 max-w-3xl" />

        <Card className="mt-10 max-w-3xl overflow-hidden py-0 shadow-md">
          <div className="h-1.5 bg-primary" />
          <CardContent className="p-6 sm:p-8">
            <form onSubmit={submit} className="space-y-3">
              <label htmlFor="medicine-name-search" className="font-display text-lg font-semibold">Nome del farmaco</label>
              <div className="relative">
                <MagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={19} />
                <Input
                  id="medicine-name-search"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value.slice(0, 80))
                    setSuggestionsOpen(true)
                  }}
                  onFocus={() => setSuggestionsOpen(true)}
                  autoComplete="off"
                  inputMode="search"
                  placeholder="es. paracetamolo"
                  className="h-14 rounded-xl pl-12 text-base"
                />
              </div>

              {suggestionsOpen && query.trim().length >= 2 && (
                <Command shouldFilter={false} className="border shadow-sm">
                  <CommandList>
                    {searchingNames ? (
                      <div className="px-4 py-6 text-center text-sm text-muted-foreground">Ricerca in corso…</div>
                    ) : (
                      <>
                        <CommandEmpty>Nessun farmaco trovato.</CommandEmpty>
                        <CommandGroup heading="Farmaci">
                          {matches.map((medicine) => (
                            <CommandItem key={medicine.key} value={medicine.key} onSelect={() => void selectMedicine(medicine)} className="cursor-pointer gap-3 px-3 py-3">
                              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Pill size={16} weight="fill" /></span>
                              <span className="min-w-0">
                                <span className="block truncate font-medium">{medicine.name}</span>
                                <span className="block text-xs text-muted-foreground">Vedi confezioni e codici AIC/MINSAN</span>
                              </span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </>
                    )}
                  </CommandList>
                </Command>
              )}

              <Button type="submit" className="h-12 w-full cursor-pointer rounded-xl sm:w-auto sm:px-7" disabled={loading || !query.trim()}>
                {loading ? "Ricerca in corso…" : "Cerca"}
                {!loading && <ArrowRight size={17} />}
              </Button>
            </form>
          </CardContent>
        </Card>

        <section ref={resultRef} className="mt-10 scroll-mt-24" aria-live="polite">
          {error && <Alert>{error}</Alert>}
          {loading && <SearchSkeleton />}
          {!loading && !result && !error && <SearchEmpty />}
          {!loading && result && <MedicineResult key={result.medicine.id} result={result} />}
        </section>
      </div>
    </div>
  )
}

function MedicineResult({ result }: { result: SearchResult }) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(result.medicine.packages.length / pageSize))
  const visiblePackages = result.medicine.packages.slice((page - 1) * pageSize, page * pageSize)

  return (
    <section aria-labelledby="medicine-result-title">
      <div className="flex flex-col justify-between gap-5 border-b pb-7 md:flex-row md:items-end">
        <div>
          <Badge variant="secondary"><Pill size={13} weight="fill" /> Farmaco</Badge>
          <h2 id="medicine-result-title" className="mt-4 font-display text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">{result.medicine.name}</h2>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Principio attivo:</span>
            {result.activeSubstances.length > 0
              ? result.activeSubstances.map((substance) => <Badge key={substance} variant="outline">{substance}</Badge>)
              : <span className="text-sm text-muted-foreground">non disponibile</span>}
          </div>
        </div>
        <div><p className="font-display text-2xl font-semibold">{result.medicine.packages.length}</p><p className="text-xs text-muted-foreground">confezioni disponibili</p></div>
      </div>

      <Card className="mt-7 overflow-hidden">
        <div className="border-b p-4 sm:p-5">
          <p className="font-medium">Confezioni e codici AIC/MINSAN</p>
          <p className="mt-1 text-xs text-muted-foreground">Ogni codice identifica una specifica confezione.</p>
        </div>

        <div className="grid gap-3 p-4 md:hidden">
          {visiblePackages.map((item) => <MobilePackageCard key={item.id} item={item} />)}
        </div>

        <div className="hidden md:block">
          <Table>
            <TableHeader><TableRow><TableHead>AIC/MINSAN</TableHead><TableHead>Confezione</TableHead><TableHead className="w-14"><span className="sr-only">Apri</span></TableHead></TableRow></TableHeader>
            <TableBody>
              {visiblePackages.map((item) => (
                <TableRow key={item.id}>
                  <TableCell><Badge variant="outline" className="font-mono tracking-wide">{item.aic}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{item.description}</TableCell>
                  <TableCell><PackageLink item={item} iconOnly /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <ResultsPagination page={page} totalPages={totalPages} totalItems={result.medicine.packages.length} onPageChange={setPage} />
      </Card>
    </section>
  )
}

function MobilePackageCard({ item }: { item: MedicinePackage }) {
  return (
    <article className="rounded-xl border bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground"><Package size={15} /> Confezione</span>
        <Badge variant="outline" className="font-mono tracking-wide">{item.aic}</Badge>
      </div>
      <p className="mt-3 text-sm leading-6">{item.description}</p>
      <div className="mt-4 flex justify-end border-t pt-3">
        <PackageLink item={item} />
      </div>
    </article>
  )
}

function PackageLink({ item, iconOnly = false }: { item: MedicinePackage; iconOnly?: boolean }) {
  return (
    <a
      href={`/?aic=${encodeURIComponent(item.aic)}`}
      aria-label={`Apri la scheda della confezione AIC/MINSAN ${item.aic}`}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center rounded-lg text-sm font-medium text-primary transition-colors hover:bg-primary/10",
        iconOnly ? "size-9" : "h-9 gap-2 px-3",
      )}
    >
      {!iconOnly && "Apri scheda"}
      <ArrowRight size={16} />
    </a>
  )
}

function ResultsPagination({ page, totalPages, totalItems, onPageChange }: { page: number; totalPages: number; totalItems: number; onPageChange: (page: number) => void }) {
  if (totalPages <= 1) return null
  const first = (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, totalItems)

  return (
    <div className="flex flex-col items-center gap-3 border-t px-4 py-4 text-center sm:flex-row sm:justify-between sm:px-5 sm:text-left">
      <p className="text-xs text-muted-foreground" aria-live="polite">Risultati {first}–{last} di {totalItems}</p>
      <Pagination className="mx-0 w-auto justify-center sm:justify-end">
        <PaginationContent>
          <PaginationItem><PaginationPrevious href="#medicine-result-title" text="Precedente" aria-disabled={page === 1} className={cn(page === 1 && "pointer-events-none opacity-50")} onClick={(event) => { event.preventDefault(); if (page > 1) onPageChange(page - 1) }} /></PaginationItem>
          <PaginationItem><span className="flex h-8 min-w-24 items-center justify-center px-2 text-xs font-medium">Pagina {page} di {totalPages}</span></PaginationItem>
          <PaginationItem><PaginationNext href="#medicine-result-title" text="Successiva" aria-disabled={page === totalPages} className={cn(page === totalPages && "pointer-events-none opacity-50")} onClick={(event) => { event.preventDefault(); if (page < totalPages) onPageChange(page + 1) }} /></PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )
}

function SearchEmpty() {
  return (
    <Empty className="border py-12">
      <EmptyHeader>
        <EmptyMedia variant="icon"><MagnifyingGlass size={18} /></EmptyMedia>
        <EmptyTitle className="font-display text-lg">Cerca un farmaco</EmptyTitle>
        <EmptyDescription>Scrivi il nome commerciale per vedere principio attivo e confezioni.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

function SearchSkeleton() {
  return <div className="space-y-5"><Skeleton className="h-10 w-72 max-w-full" /><Skeleton className="h-5 w-52" /><div className="grid gap-3 md:hidden">{Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-28" />)}</div><Skeleton className="hidden h-80 md:block" /></div>
}

function groupMedicineMatches(medicines: MedicineSummary[]): SearchCandidate[] {
  const groups = new Map<string, SearchCandidate>()
  for (const medicine of medicines) {
    const key = medicine.name.trim().toLocaleUpperCase("it")
    const existing = groups.get(key)
    if (existing) {
      existing.medicines.push(medicine)
    } else {
      groups.set(key, { key, name: medicine.name, medicines: [medicine] })
    }
  }
  return Array.from(groups.values())
}
