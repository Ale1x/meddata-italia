import { type FormEvent, useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { ArrowLeft, ArrowsLeftRight, CheckCircle, ShareNetwork, ShieldCheck, WarningCircle, XCircle } from "@phosphor-icons/react"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { SafetyNotice } from "@/components/safety-notice"
import { compareOfficialEquivalence, getPackageByAIC, normalizeAIC } from "@/lib/api"
import type { ComparedPackage, ComparisonData, PackageData } from "@/lib/types"
import { cn } from "@/lib/utils"

export function ComparePage() {
  const initialCodes = useRef({
    left: normalizeAIC(new URLSearchParams(window.location.search).get("aic") ?? ""),
    right: normalizeAIC(new URLSearchParams(window.location.search).get("compareToAic") ?? ""),
  })
  const [leftAIC, setLeftAIC] = useState(initialCodes.current.left)
  const [rightAIC, setRightAIC] = useState(initialCodes.current.right)
  const [comparison, setComparison] = useState<ComparisonData | null>(null)
  const [composition, setComposition] = useState<CompositionComparison | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const resultRef = useRef<HTMLElement>(null)
  const autoComparisonStarted = useRef(false)

  useEffect(() => {
    if (!submitted || loading || (!comparison && !error)) return
    if (!window.matchMedia("(max-width: 767px)").matches) return
    window.requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))
  }, [comparison, error, loading, submitted])

  const runComparison = useCallback(async (leftCode: string, rightCode: string, updateURL: boolean) => {
    if (leftCode.length !== 9 || rightCode.length !== 9) {
      const message = "Entrambi i codici AIC/MINSAN devono contenere 9 cifre."
      setError(message)
      setComparison(null)
      setComposition(null)
      toast.error("Codice non valido", { description: message })
      return
    }
    if (updateURL) {
      const params = new URLSearchParams({ aic: leftCode, compareToAic: rightCode })
      window.history.replaceState(null, "", `${window.location.pathname}?${params}`)
    }
    setLoading(true)
    setError("")
    setComparison(null)
    setComposition(null)
    try {
      const [leftResult, rightResult] = await Promise.allSettled([getPackageByAIC(leftCode), getPackageByAIC(rightCode)])
      if (leftResult.status === "rejected" || rightResult.status === "rejected") {
        const code = leftResult.status === "rejected" ? leftCode : rightCode
        const message = `Nessuna confezione trovata per il codice AIC/MINSAN ${code}.`
        setError(message)
        toast.error("Farmaco non trovato", { description: message })
        return
      }

      const leftPackage = leftResult.value.data
      const rightPackage = rightResult.value.data
      setComposition(compareComposition(leftPackage, rightPackage))

      if (leftCode === rightCode) {
        setComparison(samePackageComparison(leftPackage))
        return
      }

      const response = await compareOfficialEquivalence(leftCode, rightCode)
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
  }, [])

  useEffect(() => {
    if (autoComparisonStarted.current) return
    autoComparisonStarted.current = true
    const { left, right } = initialCodes.current
    if (!left || !right) return
    setSubmitted(true)
    void runComparison(left, right, false)
  }, [runComparison])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!leftAIC || !rightAIC) return
    setSubmitted(true)
    await runComparison(leftAIC, rightAIC, true)
  }

  return (
    <div className="px-5 pb-10 pt-14 sm:pt-18 lg:px-8 lg:pt-22">
      <div className="mx-auto max-w-6xl">
        <a href="/" className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground"><ArrowLeft size={16} /> Torna al catalogo</a>

        <div className="mt-8 max-w-3xl">
          <Badge variant="secondary"><ArrowsLeftRight size={13} /> Verifica documentale</Badge>
          <h1 className="mt-5 font-display text-4xl font-semibold leading-tight tracking-[-0.045em] sm:text-6xl">Confronta due confezioni nella <span className="text-primary">Lista di trasparenza.</span></h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">Inserisci i codici AIC/MINSAN per sapere se compaiono nello stesso raggruppamento dello snapshot AIFA disponibile.</p>
        </div>

        <SafetyNotice className="mt-8 max-w-3xl" />

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
                  {loading ? "Verifica in corso…" : "Verifica il raggruppamento"}
                  {!loading && <ArrowsLeftRight size={17} />}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="bg-primary py-0 text-primary-foreground">
            <CardContent className="p-6 sm:p-7">
              <span className="grid size-10 place-items-center rounded-xl bg-primary-foreground/10 text-primary-foreground"><ShieldCheck size={20} /></span>
              <h2 className="mt-5 font-display text-lg font-semibold">Cosa viene verificato</h2>
              <p className="mt-3 text-sm leading-6 text-primary-foreground/75">Solo la co-appartenenza allo stesso raggruppamento della Lista di trasparenza nazionale osservata. Non viene valutata la sostituibilità nel caso concreto.</p>
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
  const isSameGroup = comparison.same_transparency_group ?? comparison.equivalent
  const isSamePackage = comparison.reason === "SAME_PACKAGE"
  const isUnavailable = ["LEFT_NOT_IN_OFFICIAL_LIST", "RIGHT_NOT_IN_OFFICIAL_LIST", "NEITHER_IN_OFFICIAL_LIST"].includes(comparison.reason)
  const hasDifferentSubstances = composition?.sameActiveSubstances === false
  const isClearlyDifferent = isUnavailable && hasDifferentSubstances
  const showUnavailableTone = isUnavailable && !isClearlyDifferent
  const heading = isSamePackage ? "È la stessa confezione" : isSameGroup ? "Stesso raggruppamento nello snapshot" : isClearlyDifferent ? "Principi attivi diversi" : isUnavailable ? "Raggruppamento non osservato" : "Raggruppamenti diversi nello snapshot"
  const message = isClearlyDifferent && composition
    ? `Le confezioni contengono principi attivi diversi: ${composition.leftSubstances.join(" · ")} e ${composition.rightSubstances.join(" · ")}. ${comparisonMessage(comparison)}`
    : comparisonMessage(comparison)

  return (
    <Card
      role="status"
      className={cn(
        "overflow-hidden border-l-4 py-0 ring-1",
        isSameGroup
          ? "border-l-success bg-success/[0.035] ring-success/20"
          : showUnavailableTone
            ? "border-l-warning bg-warning/[0.035] ring-warning/25"
          : "border-l-destructive bg-destructive/[0.035] ring-destructive/25",
      )}
    >
      <CardContent className="p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className={cn(
              "grid size-14 shrink-0 place-items-center rounded-2xl ring-1",
              isSameGroup
                ? "bg-success/12 text-success ring-success/25"
                : showUnavailableTone
                  ? "bg-warning/12 text-warning ring-warning/25"
                : "bg-destructive/12 text-destructive ring-destructive/25",
            )}
          >
            {isSameGroup ? <CheckCircle size={30} weight="fill" /> : showUnavailableTone ? <WarningCircle size={30} weight="fill" /> : <XCircle size={30} weight="fill" />}
          </span>
          <div>
            <p className={cn("text-[11px] font-semibold uppercase tracking-[0.16em]", isSameGroup ? "text-success" : showUnavailableTone ? "text-warning" : "text-destructive")}>{isSamePackage ? "Codici identici" : isClearlyDifferent ? "Principi attivi diversi" : isUnavailable ? "Copertura della fonte" : "Esito documentale"}</p>
            <h2 className={cn("mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl", showUnavailableTone ? "text-warning" : !isSameGroup && "text-destructive")}>{heading}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{message}</p>
          </div>
        </div>

        <div className="mt-7 grid gap-4 md:grid-cols-2">
          <ComparedPackageCard item={comparison.left} label="Primo AIC/MINSAN" />
          <ComparedPackageCard item={comparison.right} label="Secondo AIC/MINSAN" />
        </div>

        {composition && !isSamePackage && <CompositionResult composition={composition} />}

        <div className="mt-7 flex justify-end border-t pt-6">
          <Button type="button" variant="outline" className="cursor-pointer" onClick={() => void shareComparison()}><ShareNetwork size={17} /> Condividi confronto</Button>
        </div>

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
        <EmptyDescription>Inserisci due codici AIC/MINSAN per verificare la loro presenza nei raggruppamenti dello snapshot disponibile.</EmptyDescription>
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
      return `Entrambe le confezioni risultano nel gruppo ${comparison.shared_official_group?.source_group_identifier}: ${comparison.shared_official_group?.label}. La co-appartenenza non sostituisce la verifica del farmacista.`
    case "DIFFERENT_OFFICIAL_GROUPS":
      return `Le confezioni sono nella lista, ma appartengono ai gruppi ${comparison.left.official_group?.source_group_identifier} e ${comparison.right.official_group?.source_group_identifier}.`
    case "LEFT_NOT_IN_OFFICIAL_LIST":
      return "La prima confezione esiste, ma non è stata osservata in un raggruppamento dello snapshot corrente. Questo non dimostra che non sia equivalente ad altri medicinali."
    case "RIGHT_NOT_IN_OFFICIAL_LIST":
      return "La seconda confezione esiste, ma non è stata osservata in un raggruppamento dello snapshot corrente. Questo non dimostra che non sia equivalente ad altri medicinali."
    default:
      return "Entrambe le confezioni esistono, ma non sono state osservate in un raggruppamento dello snapshot corrente. L’assenza dalla lista non dimostra non equivalenza."
  }
}

async function shareComparison() {
  const url = window.location.href
  try {
    if (navigator.share) {
      await navigator.share({ title: "Confronto documentale · MedData", text: "Verifica la presenza di due confezioni nei raggruppamenti della Lista di trasparenza AIFA e chiedi conferma al farmacista.", url })
      return
    }
    await navigator.clipboard.writeText(url)
    toast.success("Link copiato", { description: "Puoi inviarlo al farmacista per chiedere conferma." })
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") return
    toast.error("Link non copiato", { description: "Copia l’indirizzo dalla barra del browser." })
  }
}

type CompositionComparison = {
  sameActiveSubstances: boolean | null
  sameStrength: boolean | null
  strengthSource: "structured" | "description" | "mixed" | null
  leftSubstances: string[]
  rightSubstances: string[]
}

function CompositionResult({ composition }: { composition: CompositionComparison }) {
  const hasDifferentSubstances = composition.sameActiveSubstances === false
  return (
    <div className="mt-7 border-t pt-6">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-lg font-semibold">Confronto della composizione</h3>
        <Badge variant="outline">Informazione descrittiva</Badge>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <CompositionSignal label="Principio attivo" matches={composition.sameActiveSubstances === true} unavailable={composition.sameActiveSubstances === null} />
        <CompositionSignal label="Dosaggio pubblicato" matches={composition.sameStrength === true} unavailable={composition.sameStrength === null} unavailableText={hasDifferentSubstances ? "Non applicabile" : "Non confrontabile"} />
      </div>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        {composition.leftSubstances.join(" · ") || "Principio attivo non disponibile"} <span aria-hidden="true">↔</span> {composition.rightSubstances.join(" · ") || "Principio attivo non disponibile"}
      </p>
      {composition.strengthSource && composition.strengthSource !== "structured" && (
        <p className="mt-2 text-xs leading-5 text-muted-foreground">Il dosaggio è stato completato dalla descrizione ufficiale della confezione.</p>
      )}
      <p className="mt-3 text-xs leading-5 text-muted-foreground">{hasDifferentSubstances ? "I principi attivi sono diversi. Il servizio non valuta alternative terapeutiche: chiedi conferma a un medico o farmacista." : "Una composizione simile o la presenza nello stesso raggruppamento non determina da sola la sostituibilità nel caso concreto."}</p>
    </div>
  )
}

function CompositionSignal({ label, matches, unavailable, unavailableText = "Non confrontabile" }: { label: string; matches: boolean; unavailable: boolean; unavailableText?: string }) {
  const text = unavailable ? unavailableText : matches ? "Coincide" : "Diverso"
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
  const sameActiveSubstances = leftSubstances.length === 0 || rightSubstances.length === 0 ? null : JSON.stringify(leftSubstances) === JSON.stringify(rightSubstances)
  return {
    sameActiveSubstances,
    sameStrength: sameActiveSubstances !== true || leftStrength === null || rightStrength === null ? null : leftStrength.value === rightStrength.value,
    strengthSource: sameActiveSubstances === true ? strengthSource(leftStrength, rightStrength) : null,
    leftSubstances,
    rightSubstances,
  }
}

function ingredientNames(pkg: PackageData) {
  return pkg.active_substances.map((ingredient) => ingredient.name.trim().toLocaleUpperCase("it")).sort()
}

function strengthSignature(pkg: PackageData) {
  const values = pkg.active_substances.map((ingredient) => {
    const quantity = nonEmpty(ingredient.quantity_raw) ?? ingredient.quantity
    const unit = nonEmpty(ingredient.unit_raw) ?? nonEmpty(ingredient.unit)
    if (quantity === null || quantity === undefined || unit === null) return null
    return `${ingredient.name.trim().toLocaleUpperCase("it")}|${normalizeQuantity(quantity)}|${normalizeUnit(unit)}`
  })
  if (values.length > 0 && values.every((value) => value !== null)) {
    return { value: values.sort().join(";"), source: "structured" as const }
  }

  if (pkg.active_substances.length !== 1) return null
  const descriptionStrength = strengthFromDescription(pkg.package_description)
  if (!descriptionStrength) return null
  const substance = pkg.active_substances[0].name.trim().toLocaleUpperCase("it")
  return { value: `${substance}|${descriptionStrength}`, source: "description" as const }
}

function strengthFromDescription(description: string) {
  const match = description.toLocaleUpperCase("it").match(/(\d+(?:[.,]\d+)?)\s*(MCG|µG|UG|MG|G)(?:\s*\/\s*(?:(\d+(?:[.,]\d+)?)\s*)?(MCG|µG|UG|MG|G|ML))?/)
  if (!match) return null
  const numerator = `${normalizeQuantity(match[1])}|${normalizeUnit(match[2])}`
  if (!match[4]) return numerator
  const denominator = `${normalizeQuantity(match[3] ?? "1")}|${normalizeUnit(match[4])}`
  return `${numerator}/${denominator}`
}

function strengthSource(left: ReturnType<typeof strengthSignature>, right: ReturnType<typeof strengthSignature>): CompositionComparison["strengthSource"] {
  if (!left || !right) return null
  if (left.source === right.source) return left.source
  return "mixed"
}

function nonEmpty(value?: string | null) {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function normalizeQuantity(value: string | number) {
  const raw = String(value).trim().replace(",", ".")
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? String(parsed) : raw.toLocaleUpperCase("it")
}

function normalizeUnit(value: string) {
  const unit = value.trim().toLocaleLowerCase("it").replace(/\s+/g, "")
  const units: Array<[RegExp, string]> = [
    [/^(mcg|µg|ug|microgramm[io])$/, "mcg"],
    [/^(mg|milligramm[io])$/, "mg"],
    [/^(g|gramm[io])$/, "g"],
    [/^(ml|millilitr[io])$/, "ml"],
  ]
  return units.find(([pattern]) => pattern.test(unit))?.[1] ?? unit
}

function samePackageComparison(pkg: PackageData): ComparisonData {
  const packageGroup = pkg.transparency_group ?? pkg.official_equivalence
  const officialGroup = packageGroup
    ? {
        source_group_identifier: packageGroup.source_group_identifier,
        label: packageGroup.label,
        published_date: packageGroup.published_date,
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
    same_transparency_group: true,
    basis: "AIFA_TRANSPARENCY_LIST_GROUP_MEMBERSHIP",
    interpretation_notice: "I codici identificano la stessa confezione; non viene fornita un’indicazione terapeutica.",
    semantics: "AIFA_TRANSPARENCY_OFFICIAL",
    reason: "SAME_PACKAGE",
    left: item,
    right: item,
    shared_official_group: officialGroup,
  }
}
