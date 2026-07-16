import { type FormEvent, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { ArrowLeft, ArrowsLeftRight, CheckCircle, ShieldCheck, XCircle } from "@phosphor-icons/react"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { compareOfficialEquivalence, getPackageByAIC, normalizeAIC } from "@/lib/api"
import type { ComparedPackage, ComparisonData, PackageData } from "@/lib/types"
import { cn } from "@/lib/utils"

export function ComparePage() {
  const [leftAIC, setLeftAIC] = useState(() => normalizeAIC(new URLSearchParams(window.location.search).get("aic") ?? ""))
  const [rightAIC, setRightAIC] = useState("")
  const [comparison, setComparison] = useState<ComparisonData | null>(null)
  const [composition, setComposition] = useState<CompositionComparison | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const resultRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!submitted || loading || (!comparison && !error)) return
    if (!window.matchMedia("(max-width: 767px)").matches) return
    window.requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))
  }, [comparison, error, loading, submitted])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!leftAIC || !rightAIC) return
    setSubmitted(true)
    if (leftAIC.length !== 9 || rightAIC.length !== 9) {
      const message = "Entrambi i codici AIC/MINSAN devono contenere 9 cifre."
      setError(message)
      toast.error("Codice non valido", { description: message })
      return
    }
    setLoading(true)
    setError("")
    setComparison(null)
    setComposition(null)
    try {
      const [leftResult, rightResult] = await Promise.allSettled([getPackageByAIC(leftAIC), getPackageByAIC(rightAIC)])
      if (leftResult.status === "rejected" || rightResult.status === "rejected") {
        const code = leftResult.status === "rejected" ? leftAIC : rightAIC
        const message = `Nessuna confezione trovata per il codice AIC/MINSAN ${code}.`
        setError(message)
        toast.error("Farmaco non trovato", { description: message })
        return
      }

      const leftPackage = leftResult.value.data
      const rightPackage = rightResult.value.data
      setComposition(compareComposition(leftPackage, rightPackage))

      if (leftAIC === rightAIC) {
        setComparison(samePackageComparison(leftPackage))
        return
      }

      const response = await compareOfficialEquivalence(leftAIC, rightAIC)
      setComparison(response.data)
    } catch (cause) {
      const message = cause instanceof Error && cause.message
        ? "Non è stato possibile completare il confronto. Riprova tra poco."
        : "Confronto non riuscito."
      setError(message)
      toast.error("Confronto non disponibile", { description: message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="px-5 pb-10 pt-14 sm:pt-18 lg:px-8 lg:pt-22">
      <div className="mx-auto max-w-6xl">
        <a href="/" className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground"><ArrowLeft size={16} /> Torna al catalogo</a>

        <div className="mt-8 max-w-3xl">
          <Badge variant="secondary"><ArrowsLeftRight size={13} /> Equivalenza ufficiale</Badge>
          <h1 className="mt-5 font-display text-4xl font-semibold leading-tight tracking-[-0.045em] sm:text-6xl">Scopri se due farmaci <span className="text-primary">sono equivalenti.</span></h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">Inserisci i due codici AIC/MINSAN per verificare l’equivalenza ufficiale.</p>
        </div>

        <div className="mt-10 grid items-start gap-6 lg:grid-cols-[1.35fr_.65fr]">
          <Card className="py-0 shadow-md">
            <div className="h-1.5 bg-primary" />
            <CardHeader className="px-6 pt-6 sm:px-8 sm:pt-8">
              <CardTitle className="font-display text-xl">Codici AIC/MINSAN</CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6 sm:px-8 sm:pb-8">
              <form onSubmit={submit}>
                <FieldGroup className="grid gap-5 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="left-aic">Primo codice AIC/MINSAN</FieldLabel>
                    <Input id="left-aic" value={leftAIC} onChange={(event) => setLeftAIC(normalizeAIC(event.target.value))} inputMode="numeric" autoComplete="off" placeholder="es. 044155024" className="h-12 font-mono text-base tracking-wider" />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="right-aic">Secondo codice AIC/MINSAN</FieldLabel>
                    <Input id="right-aic" value={rightAIC} onChange={(event) => setRightAIC(normalizeAIC(event.target.value))} inputMode="numeric" autoComplete="off" placeholder="es. 039716182" className="h-12 font-mono text-base tracking-wider" />
                  </Field>
                </FieldGroup>
                <Button type="submit" size="lg" className="mt-6 h-11 w-full cursor-pointer sm:w-auto sm:px-6" disabled={!leftAIC || !rightAIC || loading}>
                  {loading ? "Verifica in corso…" : "Verifica equivalenza"}
                  {!loading && <ArrowsLeftRight size={17} />}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="bg-primary py-0 text-primary-foreground">
            <CardContent className="p-6 sm:p-7">
              <span className="grid size-10 place-items-center rounded-xl bg-primary-foreground/10 text-primary-foreground"><ShieldCheck size={20} /></span>
              <h2 className="mt-5 font-display text-lg font-semibold">Confronto ufficiale AIFA</h2>
              <p className="mt-3 text-sm leading-6 text-primary-foreground/75">Il confronto considera esclusivamente i gruppi ufficiali pubblicati da AIFA.</p>
              <div className="mt-6 border-t border-primary-foreground/15 pt-5">
                <p className="text-xs font-medium text-primary-foreground/65">Fonte: Lista di trasparenza AIFA</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <section ref={resultRef} className="mt-8 scroll-mt-24" aria-live="polite" aria-label="Risultato del confronto">
          {error && <Alert>{error}</Alert>}
          {loading && <ComparisonSkeleton />}
          {!loading && !comparison && !error && <ComparisonEmpty />}
          {!loading && comparison && <ComparisonResult comparison={comparison} composition={composition} />}
        </section>
      </div>
    </div>
  )
}

function ComparisonResult({ comparison, composition }: { comparison: ComparisonData; composition: CompositionComparison | null }) {
  const isEquivalent = comparison.equivalent
  const isSamePackage = comparison.reason === "SAME_PACKAGE"

  return (
    <Card
      role="status"
      className={cn(
        "overflow-hidden border-l-4 py-0 ring-1",
        isEquivalent
          ? "border-l-success bg-success/[0.035] ring-success/20"
          : "border-l-destructive bg-destructive/[0.035] ring-destructive/25",
      )}
    >
      <CardContent className="p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className={cn(
              "grid size-14 shrink-0 place-items-center rounded-2xl ring-1",
              isEquivalent
                ? "bg-success/12 text-success ring-success/25"
                : "bg-destructive/12 text-destructive ring-destructive/25",
            )}
          >
            {isEquivalent ? <CheckCircle size={30} weight="fill" /> : <XCircle size={30} weight="fill" />}
          </span>
          <div>
            <p className={cn("text-[11px] font-semibold uppercase tracking-[0.16em]", isEquivalent ? "text-success" : "text-destructive")}>{isSamePackage ? "Codici identici" : "Esito del confronto"}</p>
            <h2 className={cn("mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl", !isEquivalent && "text-destructive")}>{isSamePackage ? "È la stessa confezione" : isEquivalent ? "Equivalenti ufficiali" : "Non equivalenti ufficiali"}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{comparisonMessage(comparison)}</p>
          </div>
        </div>

        <div className="mt-7 grid gap-4 md:grid-cols-2">
          <ComparedPackageCard item={comparison.left} label="Primo AIC/MINSAN" />
          <ComparedPackageCard item={comparison.right} label="Secondo AIC/MINSAN" />
        </div>

        {composition && !isSamePackage && <CompositionResult composition={composition} />}

      </CardContent>
    </Card>
  )
}

function ComparedPackageCard({ item, label }: { item: ComparedPackage; label: string }) {
  return (
    <div className="rounded-2xl border bg-background p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <h3 className="mt-3 font-display text-xl font-semibold tracking-tight">{item.name}</h3>
      <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">{item.description}</p>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="font-mono tracking-wide">{item.aic}</Badge>
        {item.official_group && <Badge variant="secondary" className="bg-accent text-accent-foreground">Gruppo {item.official_group.source_group_identifier}</Badge>}
      </div>
    </div>
  )
}

function ComparisonEmpty() {
  return (
    <Empty className="border py-12">
      <EmptyHeader>
        <EmptyMedia variant="icon"><ArrowsLeftRight size={18} /></EmptyMedia>
        <EmptyTitle className="font-display text-lg">Confronta due confezioni</EmptyTitle>
        <EmptyDescription>Inserisci due codici AIC/MINSAN per verificarne l’equivalenza ufficiale.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

function ComparisonSkeleton() {
  return <div className="space-y-4 rounded-xl border p-6 sm:p-8"><div className="flex gap-4"><Skeleton className="size-12 rounded-2xl" /><div className="flex-1"><Skeleton className="h-4 w-32" /><Skeleton className="mt-3 h-8 w-64 max-w-full" /><Skeleton className="mt-3 h-4 w-full max-w-xl" /></div></div><div className="grid gap-4 pt-4 md:grid-cols-2"><Skeleton className="h-40" /><Skeleton className="h-40" /></div></div>
}

function comparisonMessage(comparison: ComparisonData) {
  switch (comparison.reason) {
    case "SAME_PACKAGE":
      return "I due codici indicano esattamente la stessa confezione."
    case "SAME_OFFICIAL_GROUP":
      return `Entrambe le confezioni appartengono al gruppo ${comparison.shared_official_group?.source_group_identifier}: ${comparison.shared_official_group?.label}.`
    case "DIFFERENT_OFFICIAL_GROUPS":
      return `Le confezioni sono nella lista, ma appartengono ai gruppi ${comparison.left.official_group?.source_group_identifier} e ${comparison.right.official_group?.source_group_identifier}.`
    case "LEFT_NOT_IN_OFFICIAL_LIST":
      return "La prima confezione esiste, ma non è inclusa in un gruppo ufficiale della lista di trasparenza AIFA."
    case "RIGHT_NOT_IN_OFFICIAL_LIST":
      return "La seconda confezione esiste, ma non è inclusa in un gruppo ufficiale della lista di trasparenza AIFA."
    default:
      return "Entrambe le confezioni esistono, ma nessuna è inclusa in un gruppo ufficiale della lista di trasparenza AIFA."
  }
}

type CompositionComparison = {
  sameActiveSubstances: boolean | null
  sameStrength: boolean | null
  leftSubstances: string[]
  rightSubstances: string[]
}

function CompositionResult({ composition }: { composition: CompositionComparison }) {
  return (
    <div className="mt-7 border-t pt-6">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-lg font-semibold">Confronto della composizione</h3>
        <Badge variant="outline">Informazione descrittiva</Badge>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <CompositionSignal label="Principio attivo" matches={composition.sameActiveSubstances === true} unavailable={composition.sameActiveSubstances === null} />
        <CompositionSignal label="Dosaggio pubblicato" matches={composition.sameStrength === true} unavailable={composition.sameStrength === null} />
      </div>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        {composition.leftSubstances.join(" · ") || "Principio attivo non disponibile"} <span aria-hidden="true">↔</span> {composition.rightSubstances.join(" · ") || "Principio attivo non disponibile"}
      </p>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">La composizione simile non prova la sostituibilità: l’esito ufficiale deriva esclusivamente dalla lista di trasparenza AIFA.</p>
    </div>
  )
}

function CompositionSignal({ label, matches, unavailable }: { label: string; matches: boolean; unavailable: boolean }) {
  const text = unavailable ? "Non confrontabile" : matches ? "Coincide" : "Diverso"
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border bg-background p-4">
      <span className="text-sm font-medium">{label}</span>
      <Badge variant={matches && !unavailable ? "secondary" : "outline"} className={cn(matches && !unavailable && "bg-success/10 text-success")}>{text}</Badge>
    </div>
  )
}

function compareComposition(left: PackageData, right: PackageData): CompositionComparison {
  const leftSubstances = ingredientNames(left)
  const rightSubstances = ingredientNames(right)
  const leftStrength = strengthSignature(left)
  const rightStrength = strengthSignature(right)
  return {
    sameActiveSubstances: leftSubstances.length === 0 || rightSubstances.length === 0 ? null : JSON.stringify(leftSubstances) === JSON.stringify(rightSubstances),
    sameStrength: leftStrength === null || rightStrength === null ? null : leftStrength === rightStrength,
    leftSubstances,
    rightSubstances,
  }
}

function ingredientNames(pkg: PackageData) {
  return pkg.active_substances.map((ingredient) => ingredient.name.trim().toLocaleUpperCase("it")).sort()
}

function strengthSignature(pkg: PackageData) {
  const values = pkg.active_substances.map((ingredient) => {
    const quantity = ingredient.quantity_raw ?? ingredient.quantity
    const unit = ingredient.unit_raw ?? ingredient.unit
    if (quantity === null || quantity === undefined || !unit) return null
    return `${ingredient.name.trim().toLocaleUpperCase("it")}|${String(quantity).trim().toLocaleUpperCase("it")}|${unit.trim().toLocaleUpperCase("it")}`
  })
  if (values.some((value) => value === null)) return null
  return values.sort().join(";")
}

function samePackageComparison(pkg: PackageData): ComparisonData {
  const officialGroup = pkg.official_equivalence
    ? {
        source_group_identifier: pkg.official_equivalence.source_group_identifier,
        label: pkg.official_equivalence.label,
        published_date: pkg.official_equivalence.published_date,
      }
    : null
  const item: ComparedPackage = {
    id: pkg.id,
    aic: pkg.aic,
    name: pkg.medicine.name,
    description: pkg.package_description,
    official_group: officialGroup,
  }
  return {
    equivalent: true,
    semantics: "AIFA_TRANSPARENCY_OFFICIAL",
    reason: "SAME_PACKAGE",
    left: item,
    right: item,
    shared_official_group: officialGroup,
  }
}
