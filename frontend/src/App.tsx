import { FormEvent, useEffect, useMemo, useState } from "react"
import {
  ArrowRight,
  ArrowsLeftRight,
  CheckCircle,
  Database,
  Flask,
  Heartbeat,
  MagnifyingGlass,
  Moon,
  Package,
  Pill,
  ShieldCheck,
  Sun,
  XCircle,
} from "@phosphor-icons/react"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type NamedEntity = { id: string; name: string }
type Ingredient = NamedEntity & { quantity: number | null; quantity_raw: string | null; unit: string | null; unit_raw: string | null }
type PackageData = {
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
  official_equivalence?: {
    authority: string
    group_id: string
    label: string
    published_date: string
    source_group_identifier: string
  }
  provenance?: { source: string; artifact_hash: string; downloaded_at: string; observed_at: string }[]
  observed_at: string
}
type Equivalent = { id: string; aic: string; name: string; description: string }
type EquivalenceData = {
  authority: string
  source: string
  source_publication_date: string
  group_source_identifier: string
  group_label: string
  members: Equivalent[]
  reference_prices: { kind: string; amount: number; currency: string }[]
  artifact_hash: string
}
type ComparedPackage = {
  id: string
  aic: string
  name: string
  description: string
  official_group: { source_group_identifier: string; label: string; published_date: string } | null
}
type ComparisonData = {
  equivalent: boolean
  semantics: "AIFA_TRANSPARENCY_OFFICIAL"
  reason: "SAME_OFFICIAL_GROUP" | "DIFFERENT_OFFICIAL_GROUPS" | "LEFT_NOT_IN_OFFICIAL_LIST" | "RIGHT_NOT_IN_OFFICIAL_LIST" | "NEITHER_IN_OFFICIAL_LIST"
  left: ComparedPackage
  right: ComparedPackage
  shared_official_group: { source_group_identifier: string; label: string; published_date: string } | null
}

const initialAIC = "026089019"

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "")

async function request<T>(url: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${url}`)
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error?.detail ?? `Richiesta non riuscita (${response.status})`)
  }
  return response.json()
}

function formatDate(value?: string) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
}

function App() {
  const [query, setQuery] = useState(initialAIC)
  const [pkg, setPkg] = useState<PackageData | null>(null)
  const [equivalence, setEquivalence] = useState<EquivalenceData | null>(null)
  const [memberFilter, setMemberFilter] = useState("")
  const [leftAIC, setLeftAIC] = useState("044155024")
  const [rightAIC, setRightAIC] = useState("039716182")
  const [comparison, setComparison] = useState<ComparisonData | null>(null)
  const [comparisonLoading, setComparisonLoading] = useState(true)
  const [comparisonError, setComparisonError] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [dark, setDark] = useState(false)

  async function search(aic: string) {
    const normalized = aic.replace(/\D/g, "")
    if (!normalized) return
    setLoading(true)
    setError("")
    setEquivalence(null)
    try {
      const packageResponse = await request<{ data: PackageData }>(`/api/v1/packages/by-aic/${normalized}?include=provenance`)
      setPkg(packageResponse.data)
      if (packageResponse.data.official_equivalence) {
        const equivalentResponse = await request<{ data: EquivalenceData }>(`/api/v1/packages/${packageResponse.data.id}/official-equivalents`)
        setEquivalence(equivalentResponse.data)
      }
    } catch (err) {
      setPkg(null)
      setError(err instanceof Error ? err.message : "Errore inatteso")
    } finally {
      setLoading(false)
    }
  }

  async function compare(left: string, right: string) {
    setComparisonLoading(true)
    setComparisonError("")
    try {
      const response = await request<{ data: ComparisonData }>(`/api/v1/official-equivalence/compare?left_aic=${encodeURIComponent(left.replace(/\D/g, ""))}&right_aic=${encodeURIComponent(right.replace(/\D/g, ""))}`)
      setComparison(response.data)
    } catch (err) {
      setComparison(null)
      setComparisonError(err instanceof Error ? err.message : "Confronto non riuscito")
    } finally {
      setComparisonLoading(false)
    }
  }

  useEffect(() => { void search(initialAIC); void compare("044155024", "039716182") }, [])
  useEffect(() => { document.documentElement.classList.toggle("dark", dark) }, [dark])

  const visibleMembers = useMemo(() => {
    const needle = memberFilter.toLowerCase().trim()
    const members = equivalence?.members ?? []
    if (!needle) return members.slice(0, 12)
    return members.filter((member) => `${member.name} ${member.aic}`.toLowerCase().includes(needle)).slice(0, 20)
  }, [equivalence, memberFilter])

  const referencePrice = equivalence?.reference_prices.find((price) => price.kind === "REFERENCE_PRICE")

  function submit(event: FormEvent) {
    event.preventDefault()
    void search(query)
  }

  function submitComparison(event: FormEvent) {
    event.preventDefault()
    void compare(leftAIC, rightAIC)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
          <a href="#top" className="flex items-center gap-2.5 font-semibold tracking-tight">
            <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-600 text-white"><Pill size={20} weight="fill" /></span>
            <span>MedData</span>
            <Badge variant="outline" className="hidden sm:inline-flex">demo</Badge>
          </a>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a className="transition-colors hover:text-foreground" href="#catalogo">Catalogo</a>
            <a className="transition-colors hover:text-foreground" href="#confronta">Confronta</a>
            <a className="transition-colors hover:text-foreground" href="#equivalenti">Equivalenti</a>
            <a className="transition-colors hover:text-foreground" href="#provenienza">Provenienza</a>
          </nav>
          <div className="flex items-center gap-2">
            <Badge variant="success" className="hidden sm:inline-flex"><span className="size-1.5 rounded-full bg-emerald-600" /> API live</Badge>
            <Button variant="ghost" size="icon" onClick={() => setDark((value) => !value)} aria-label="Cambia tema">
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </Button>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="border-b bg-muted/20">
          <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-24">
            <div className="max-w-3xl">
              <Badge variant="success"><ShieldCheck size={14} weight="fill" /> Solo equivalenze ufficiali AIFA</Badge>
              <h1 className="mt-6 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl lg:text-6xl">Un codice AIC.<br /><span className="text-muted-foreground">Tutto ciò che è ufficiale.</span></h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">Consulta confezione, principi attivi, classificazione ATC e gruppo di equivalenza della lista di trasparenza, con provenienza verificabile.</p>
            </div>

            <Card className="mt-10 max-w-3xl border-emerald-200/80 bg-card/95 shadow-[0_16px_50px_rgba(15,23,42,0.08)] dark:border-emerald-900">
              <CardContent className="p-4 sm:p-5">
                <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative flex-1">
                    <MagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={19} />
                    <Input value={query} onChange={(event) => setQuery(event.target.value)} inputMode="numeric" placeholder="Inserisci il codice AIC" className="h-12 pl-11 font-mono text-base" aria-label="Codice AIC" />
                  </div>
                  <Button type="submit" className="h-12 px-6" disabled={loading}>Cerca confezione <ArrowRight size={17} /></Button>
                </form>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>Prova:</span>
                  {["026089019", "036816015", "044155024"].map((aic) => <button key={aic} className="rounded border px-2 py-1 font-mono hover:bg-muted" onClick={() => { setQuery(aic); void search(aic) }}>{aic}</button>)}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="confronta" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-12 lg:px-8 lg:py-16">
          <div className="grid items-start gap-8 lg:grid-cols-[.75fr_1.25fr]">
            <div>
              <Badge variant="outline"><ArrowsLeftRight size={14} /> Confronto ufficiale</Badge>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight">Sono equivalenti?</h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">Inserisci due codici AIC. La risposta è positiva solo se le confezioni appartengono allo stesso gruppo della lista di trasparenza AIFA.</p>
              <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 text-sm leading-6 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
                Stesso principio attivo o stesso ATC, da soli, non significano equivalenza ufficiale.
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Confronta due confezioni</CardTitle>
                <CardDescription>Prova l’esempio precompilato: entrambi gli AIC appartengono al gruppo ufficiale H1A.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={submitComparison} className="grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-end">
                  <label className="grid gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Primo AIC<Input className="font-mono text-base normal-case tracking-normal text-foreground" inputMode="numeric" value={leftAIC} onChange={(event) => setLeftAIC(event.target.value)} /></label>
                  <ArrowsLeftRight className="mb-3 hidden text-muted-foreground sm:block" size={20} />
                  <label className="grid gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Secondo AIC<Input className="font-mono text-base normal-case tracking-normal text-foreground" inputMode="numeric" value={rightAIC} onChange={(event) => setRightAIC(event.target.value)} /></label>
                  <Button type="submit" className="h-11" disabled={comparisonLoading}>Confronta</Button>
                </form>

                <div className="mt-6">
                  {comparisonLoading && <Skeleton className="h-36" />}
                  {comparisonError && <Alert>{comparisonError}</Alert>}
                  {comparison && !comparisonLoading && (
                    <div className={comparison.equivalent ? "rounded-xl border border-emerald-200 bg-emerald-50/60 p-5 dark:border-emerald-900 dark:bg-emerald-950/25" : "rounded-xl border bg-muted/35 p-5"}>
                      <div className="flex items-start gap-3">
                        <span className={comparison.equivalent ? "text-emerald-600" : "text-muted-foreground"}>{comparison.equivalent ? <CheckCircle size={28} weight="fill" /> : <XCircle size={28} weight="fill" />}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-lg font-semibold">{comparison.equivalent ? "Sì, sono equivalenti ufficiali" : "No, non risultano equivalenti ufficiali"}</p>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">{comparisonMessage(comparison)}</p>
                        </div>
                      </div>
                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        {[comparison.left, comparison.right].map((item) => (
                          <div key={item.id} className="rounded-lg border bg-background p-4">
                            <p className="truncate font-medium">{item.name}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2"><Badge variant="outline" className="font-mono">{item.aic}</Badge>{item.official_group && <Badge variant="success">Gruppo {item.official_group.source_group_identifier}</Badge>}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="catalogo" className="mx-auto max-w-7xl scroll-mt-24 border-t px-5 py-12 lg:px-8 lg:py-16">
          {error && <Alert className="mb-8">{error}</Alert>}
          {loading ? <LoadingState /> : pkg && (
            <>
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="font-mono">AIC {pkg.aic}</Badge>
                    {pkg.administrative_status && <Badge variant="success"><CheckCircle size={13} weight="fill" /> {pkg.administrative_status}</Badge>}
                  </div>
                  <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{pkg.medicine.name}</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{pkg.package_description}</p>
                </div>
                <div className="text-left md:text-right">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Ultima osservazione</p>
                  <p className="mt-1 text-sm font-medium">{formatDate(pkg.observed_at)}</p>
                </div>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Stat icon={<Flask size={20} />} label="Principi attivi" value={String(pkg.active_substances.length)} note={pkg.active_substances.map((item) => item.name).join(" · ")} />
                <Stat icon={<Database size={20} />} label="Codice ATC" value={pkg.atc[0]?.code ?? "—"} note={pkg.atc[0]?.description ?? "Non disponibile"} />
                <Stat icon={<Package size={20} />} label="Regime di fornitura" value={pkg.supply_regime ?? "—"} note={pkg.pharmaceutical_form?.name ?? "Forma non strutturata"} />
                <Stat icon={<ShieldCheck size={20} />} label="Gruppo ufficiale" value={pkg.official_equivalence?.source_group_identifier ?? "—"} note={pkg.official_equivalence?.label ?? "Non presente in trasparenza"} accent />
              </div>

              <div className="mt-8 grid gap-6 lg:grid-cols-[1.45fr_.75fr]">
                <Card>
                  <CardHeader><CardTitle>Composizione e classificazione</CardTitle><CardDescription>Dati normalizzati dall’anagrafica AIFA, senza completamenti inferiti.</CardDescription></CardHeader>
                  <CardContent className="space-y-5">
                    <div>
                      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Principi attivi</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {pkg.active_substances.map((ingredient) => (
                          <div key={ingredient.id} className="rounded-lg border bg-muted/25 p-4">
                            <p className="font-medium">{ingredient.name}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{ingredient.quantity_raw || "Dosaggio incluso nella descrizione della confezione"} {ingredient.unit_raw}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <Separator />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Detail label="Titolare AIC" value={pkg.authorization_holder?.name} />
                      <Detail label="Forma farmaceutica" value={pkg.pharmaceutical_form?.name} />
                      <Detail label="Stato amministrativo" value={pkg.administrative_status} />
                      <Detail label="Fornitura" value={pkg.supply_regime} />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-emerald-200 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/20">
                  <CardHeader><CardTitle className="flex items-center gap-2"><Heartbeat className="text-emerald-600" size={21} /> Affidabilità del dato</CardTitle><CardDescription>Ogni risultato è legato all’artefatto sorgente acquisito.</CardDescription></CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <Detail label="Fonte catalogo" value={pkg.provenance?.[0]?.source} />
                    <Detail label="Scaricato" value={formatDate(pkg.provenance?.[0]?.downloaded_at)} />
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">SHA-256</p>
                      <p className="mt-1 break-all font-mono text-xs leading-5">{pkg.provenance?.[0]?.artifact_hash ?? "—"}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </section>

        {pkg && equivalence && (
          <section id="equivalenti" className="scroll-mt-24 border-y bg-muted/25">
            <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8 lg:py-20">
              <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
                <div className="max-w-3xl">
                  <Badge variant="success"><ShieldCheck size={14} /> {equivalence.authority} · lista di trasparenza</Badge>
                  <h2 className="mt-4 text-3xl font-semibold tracking-tight">Equivalenti ufficiali</h2>
                  <p className="mt-2 text-muted-foreground">Gruppo <span className="font-mono font-medium text-foreground">{equivalence.group_source_identifier}</span> · {equivalence.group_label}</p>
                </div>
                <div className="flex gap-6">
                  <div><p className="text-2xl font-semibold">{equivalence.members.length}</p><p className="text-xs text-muted-foreground">altre confezioni</p></div>
                  <div><p className="text-2xl font-semibold">{referencePrice ? `${Number(referencePrice.amount).toFixed(2)} €` : "—"}</p><p className="text-xs text-muted-foreground">prezzo riferimento</p></div>
                </div>
              </div>

              <Card className="mt-8 overflow-hidden">
                <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div><p className="font-medium">Confezioni nello stesso gruppo</p><p className="text-sm text-muted-foreground">Sono escluse relazioni per solo principio attivo o ATC.</p></div>
                  <div className="relative w-full sm:w-72"><MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} /><Input className="h-9 pl-9" placeholder="Filtra nome o AIC" value={memberFilter} onChange={(event) => setMemberFilter(event.target.value)} /></div>
                </div>
                <Table>
                  <TableHeader><TableRow><TableHead>Medicinale</TableHead><TableHead>AIC</TableHead><TableHead className="hidden lg:table-cell">Confezione</TableHead><TableHead className="w-12" /></TableRow></TableHeader>
                  <TableBody>
                    {visibleMembers.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">{member.name}</TableCell>
                        <TableCell className="font-mono text-xs">{member.aic}</TableCell>
                        <TableCell className="hidden max-w-xl text-muted-foreground lg:table-cell">{member.description}</TableCell>
                        <TableCell><button className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Apri ${member.name}`} onClick={() => { setQuery(member.aic); void search(member.aic); window.scrollTo({ top: 0, behavior: "smooth" }) }}><ArrowRight size={16} /></button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {equivalence.members.length > visibleMembers.length && !memberFilter && <div className="border-t px-4 py-3 text-center text-xs text-muted-foreground">Prime 12 di {equivalence.members.length} confezioni · usa il filtro per cercare</div>}
              </Card>
            </div>
          </section>
        )}

        <section id="provenienza" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-14 lg:px-8">
          <div className="grid gap-4 md:grid-cols-3">
            <InfoCard icon={<Database size={21} />} title="Artifact immutabili" text="HTML di discovery e file originali sono conservati con hash SHA-256." />
            <InfoCard icon={<ShieldCheck size={21} />} title="Semantica esplicita" text="L’endpoint usa soltanto AIFA_TRANSPARENCY_OFFICIAL." />
            <InfoCard icon={<Heartbeat size={21} />} title="Freshness visibile" text="Snapshot, osservazione e pubblicazione accompagnano ogni risposta critica." />
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <p>MedData demo · dati pubblici AIFA, licenza CC BY 4.0</p>
          <p>Consultazione informativa, non consiglio medico.</p>
        </div>
      </footer>
    </div>
  )
}

function Stat({ icon, label, value, note, accent = false }: { icon: React.ReactNode; label: string; value: string; note: string; accent?: boolean }) {
  return <Card className={accent ? "border-emerald-200 dark:border-emerald-900" : ""}><CardContent className="p-5"><div className="flex items-center justify-between text-muted-foreground"><span className="text-xs font-medium uppercase tracking-wider">{label}</span><span className={accent ? "text-emerald-600" : ""}>{icon}</span></div><p className="mt-4 truncate text-xl font-semibold">{value}</p><p className="mt-1 line-clamp-2 min-h-10 text-xs leading-5 text-muted-foreground">{note}</p></CardContent></Card>
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return <div><p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium leading-5">{value || "Non disponibile"}</p></div>
}

function InfoCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="flex items-start gap-4 rounded-xl border p-5"><span className="mt-0.5 text-emerald-600">{icon}</span><div><p className="font-medium">{title}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p></div></div>
}

function LoadingState() {
  return <div className="space-y-8"><div><Skeleton className="h-5 w-32" /><Skeleton className="mt-4 h-10 w-72" /><Skeleton className="mt-3 h-4 w-full max-w-2xl" /></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-36" />)}</div><div className="grid gap-6 lg:grid-cols-[1.45fr_.75fr]"><Skeleton className="h-80" /><Skeleton className="h-80" /></div></div>
}

function comparisonMessage(comparison: ComparisonData) {
  switch (comparison.reason) {
    case "SAME_OFFICIAL_GROUP":
      return `Entrambe le confezioni appartengono al gruppo ${comparison.shared_official_group?.source_group_identifier}: ${comparison.shared_official_group?.label}.`
    case "DIFFERENT_OFFICIAL_GROUPS":
      return `Le confezioni sono presenti nella lista, ma nei gruppi ${comparison.left.official_group?.source_group_identifier} e ${comparison.right.official_group?.source_group_identifier}.`
    case "LEFT_NOT_IN_OFFICIAL_LIST":
      return "Il primo AIC non appartiene a un gruppo corrente della lista di trasparenza."
    case "RIGHT_NOT_IN_OFFICIAL_LIST":
      return "Il secondo AIC non appartiene a un gruppo corrente della lista di trasparenza."
    default:
      return "Nessuno dei due AIC appartiene a un gruppo corrente della lista di trasparenza."
  }
}

export default App
