import { type FormEvent, useState } from "react"
import { ArrowLeft, ArrowsLeftRight, CheckCircle, Info, ShieldCheck, XCircle } from "@phosphor-icons/react"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { compareOfficialEquivalence, normalizeAIC } from "@/lib/api"
import type { ComparedPackage, ComparisonData } from "@/lib/types"
import { cn } from "@/lib/utils"

export function ComparePage() {
  const [leftAIC, setLeftAIC] = useState("")
  const [rightAIC, setRightAIC] = useState("")
  const [comparison, setComparison] = useState<ComparisonData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!leftAIC || !rightAIC) return
    setLoading(true)
    setError("")
    setComparison(null)
    try {
      const response = await compareOfficialEquivalence(leftAIC, rightAIC)
      setComparison(response.data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Confronto non riuscito.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="px-5 pb-10 pt-14 sm:pt-18 lg:px-8 lg:pt-22">
      <div className="mx-auto max-w-6xl">
        <a href="/" className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground"><ArrowLeft size={16} /> Torna al catalogo</a>

        <div className="mt-8 max-w-3xl">
          <Badge variant="secondary"><ArrowsLeftRight size={13} /> Confronto AIC</Badge>
          <h1 className="mt-5 font-display text-4xl font-semibold leading-tight tracking-[-0.045em] sm:text-6xl">Due confezioni.<br /><span className="text-primary">Una risposta ufficiale.</span></h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">Verifica se due codici AIC appartengono allo stesso gruppo della lista di trasparenza AIFA. Nessuna equivalenza viene dedotta dal solo principio attivo.</p>
        </div>

        <div className="mt-10 grid items-start gap-6 lg:grid-cols-[1.35fr_.65fr]">
          <Card className="py-0 shadow-md">
            <div className="h-1.5 bg-primary" />
            <CardHeader className="px-6 pt-6 sm:px-8 sm:pt-8">
              <CardTitle className="font-display text-xl">Inserisci i codici</CardTitle>
              <CardDescription>I campi partono vuoti e accettano esclusivamente valori numerici da 1 a 9 cifre.</CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-6 sm:px-8 sm:pb-8">
              <form onSubmit={submit}>
                <FieldGroup className="grid gap-5 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="left-aic">Primo codice AIC</FieldLabel>
                    <Input id="left-aic" value={leftAIC} onChange={(event) => setLeftAIC(normalizeAIC(event.target.value))} inputMode="numeric" autoComplete="off" placeholder="es. 044155024" className="h-12 font-mono text-base tracking-wider" />
                    <FieldDescription>Confezione da confrontare.</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="right-aic">Secondo codice AIC</FieldLabel>
                    <Input id="right-aic" value={rightAIC} onChange={(event) => setRightAIC(normalizeAIC(event.target.value))} inputMode="numeric" autoComplete="off" placeholder="es. 039716182" className="h-12 font-mono text-base tracking-wider" />
                    <FieldDescription>Confezione di confronto.</FieldDescription>
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
              <h2 className="mt-5 font-display text-lg font-semibold">Criterio utilizzato</h2>
              <p className="mt-3 text-sm leading-6 text-primary-foreground/75">La risposta è positiva solo quando entrambi gli AIC sono membri correnti dello stesso gruppo ufficiale AIFA.</p>
              <div className="mt-6 border-t border-primary-foreground/15 pt-5">
                <p className="font-mono text-[11px] tracking-wide text-primary-foreground/65">AIFA_TRANSPARENCY_OFFICIAL</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <section className="mt-8" aria-live="polite" aria-label="Risultato del confronto">
          {error && <Alert>{error}</Alert>}
          {loading && <ComparisonSkeleton />}
          {!loading && !comparison && !error && <ComparisonEmpty />}
          {!loading && comparison && <ComparisonResult comparison={comparison} />}
        </section>
      </div>
    </div>
  )
}

function ComparisonResult({ comparison }: { comparison: ComparisonData }) {
  return (
    <Card className={cn("py-0", comparison.equivalent ? "ring-primary/30" : "ring-foreground/15")}>
      <CardContent className="p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <span className={cn("grid size-12 shrink-0 place-items-center rounded-2xl", comparison.equivalent ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
            {comparison.equivalent ? <CheckCircle size={26} weight="fill" /> : <XCircle size={26} weight="fill" />}
          </span>
          <div>
            <p className="eyebrow">Esito del confronto</p>
            <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">{comparison.equivalent ? "Equivalenti ufficiali" : "Non equivalenti ufficiali"}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{comparisonMessage(comparison)}</p>
          </div>
        </div>

        <div className="mt-7 grid gap-4 md:grid-cols-2">
          <ComparedPackageCard item={comparison.left} label="Primo AIC" />
          <ComparedPackageCard item={comparison.right} label="Secondo AIC" />
        </div>

        <div className="mt-6 flex items-start gap-2.5 rounded-xl bg-muted/60 p-4 text-xs leading-5 text-muted-foreground">
          <Info className="mt-0.5 shrink-0" size={16} />
          <p>Esito calcolato esclusivamente dalla membership corrente della lista di trasparenza, non da similarità terapeutiche o classificazioni ATC.</p>
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
        {item.official_group && <Badge variant="secondary">Gruppo {item.official_group.source_group_identifier}</Badge>}
      </div>
    </div>
  )
}

function ComparisonEmpty() {
  return (
    <Empty className="border py-12">
      <EmptyHeader>
        <EmptyMedia variant="icon"><ArrowsLeftRight size={18} /></EmptyMedia>
        <EmptyTitle className="font-display text-lg">Nessun confronto ancora</EmptyTitle>
        <EmptyDescription>Inserisci due codici AIC per visualizzare qui l’esito e i gruppi ufficiali associati.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

function ComparisonSkeleton() {
  return <div className="space-y-4 rounded-xl border p-6 sm:p-8"><div className="flex gap-4"><Skeleton className="size-12 rounded-2xl" /><div className="flex-1"><Skeleton className="h-4 w-32" /><Skeleton className="mt-3 h-8 w-64 max-w-full" /><Skeleton className="mt-3 h-4 w-full max-w-xl" /></div></div><div className="grid gap-4 pt-4 md:grid-cols-2"><Skeleton className="h-40" /><Skeleton className="h-40" /></div></div>
}

function comparisonMessage(comparison: ComparisonData) {
  switch (comparison.reason) {
    case "SAME_OFFICIAL_GROUP":
      return `Entrambe le confezioni appartengono al gruppo ${comparison.shared_official_group?.source_group_identifier}: ${comparison.shared_official_group?.label}.`
    case "DIFFERENT_OFFICIAL_GROUPS":
      return `Le confezioni sono nella lista, ma appartengono ai gruppi ${comparison.left.official_group?.source_group_identifier} e ${comparison.right.official_group?.source_group_identifier}.`
    case "LEFT_NOT_IN_OFFICIAL_LIST":
      return "Il primo AIC non appartiene a un gruppo corrente della lista di trasparenza."
    case "RIGHT_NOT_IN_OFFICIAL_LIST":
      return "Il secondo AIC non appartiene a un gruppo corrente della lista di trasparenza."
    default:
      return "Nessuno dei due AIC appartiene a un gruppo corrente della lista di trasparenza."
  }
}
