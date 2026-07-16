import { useEffect, useState, type ReactNode } from "react"
import { ArrowUpRight, ArrowsLeftRight, Database, House, MagnifyingGlass, Moon, Pill, Sun } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { getLatestIngestions, getSources } from "@/lib/api"
import type { IngestionSummary, SourceSummary } from "@/lib/types"
import { cn } from "@/lib/utils"

type AppShellProps = {
  activePage: "dashboard" | "search" | "compare"
  children: ReactNode
}

export function AppShell({ activePage, children }: AppShellProps) {
  const [dark, setDark] = useState(() => window.localStorage.getItem("meddata-theme") === "dark")
  const [freshness, setFreshness] = useState<{ ingestions: IngestionSummary[]; sources: SourceSummary[] } | null>(null)

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark)
    window.localStorage.setItem("meddata-theme", dark ? "dark" : "light")
  }, [dark])

  useEffect(() => {
    let active = true
    Promise.all([getLatestIngestions(), getSources()])
      .then(([ingestions, sources]) => {
        if (active) setFreshness({ ingestions: ingestions.data, sources: sources.data })
      })
      .catch(() => {
        if (active) setFreshness({ ingestions: [], sources: [] })
      })
    return () => { active = false }
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a className="skip-link" href="#main-content">Vai al contenuto</a>
      <header className="sticky top-0 z-50 px-3 pt-3 sm:px-5">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between rounded-2xl border bg-background/92 px-3 shadow-sm backdrop-blur-xl sm:px-5">
          <a href="/" className="flex cursor-pointer items-center gap-2.5 rounded-lg focus-visible:ring-2 focus-visible:ring-ring">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Pill size={19} weight="fill" />
            </span>
            <span className="hidden font-display text-[17px] font-semibold tracking-[-0.02em] sm:inline">MedData</span>
          </a>

          <nav aria-label="Navigazione principale" className="flex items-center gap-1 rounded-xl bg-muted/70 p-1">
            <NavLink href="/" active={activePage === "dashboard"} icon={<House size={15} />}>Catalogo</NavLink>
            <NavLink href="/search" active={activePage === "search"} icon={<MagnifyingGlass size={15} />}>Cerca</NavLink>
            <NavLink href="/compare" active={activePage === "compare"} icon={<ArrowsLeftRight size={15} />}>Confronta</NavLink>
            <a href="https://api.health.passarelli.dev/docs" target="_blank" rel="noreferrer" className="hidden cursor-pointer items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground md:flex">API <ArrowUpRight size={13} /></a>
          </nav>

          <div className="flex items-center gap-2">
            <FreshnessTooltip freshness={freshness} />
            <Button variant="ghost" size="icon" className="cursor-pointer rounded-xl" onClick={() => setDark((value) => !value)} aria-label={dark ? "Attiva tema chiaro" : "Attiva tema scuro"}>
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </Button>
          </div>
        </div>
      </header>

      <main id="main-content">{children}</main>

      <footer className="mx-auto max-w-7xl px-5 pb-8 pt-16 lg:px-8">
        <div className="flex flex-col gap-3 border-t pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>MedData · dati pubblici AIFA · CC BY 4.0</p>
          <p>Servizio informativo, non sostituisce medico o farmacista.</p>
        </div>
      </footer>
    </div>
  )
}

function FreshnessTooltip({ freshness }: { freshness: { ingestions: IngestionSummary[]; sources: SourceSummary[] } | null }) {
  const items = [
    { id: "aifa-packages", label: "Farmaci e confezioni", fallbackFrequency: "daily" },
    { id: "aifa-transparency-list", label: "Equivalenti ufficiali", fallbackFrequency: "monthly" },
  ].map((item) => ({
    ...item,
    ingestion: freshness?.ingestions.find((ingestion) => ingestion.source_id === item.id),
    frequency: freshness?.sources.find((source) => source.id === item.id)?.declared_frequency ?? item.fallbackFrequency,
  }))
  const hasData = items.some((item) => item.ingestion?.finished_at)

  return (
    <Tooltip>
      <TooltipTrigger
        render={<button type="button" className="flex min-h-9 cursor-help items-center gap-2 rounded-lg px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Aggiornamento dati AIFA" />}
      >
        <span className={cn("size-2 rounded-full", freshness === null ? "animate-pulse bg-muted-foreground" : hasData ? "bg-success shadow-[0_0_0_4px_color-mix(in_srgb,var(--success)_14%,transparent)]" : "bg-warning")} />
        <Database size={16} className="lg:hidden" />
        <span className="hidden lg:inline">Dati AIFA</span>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="end" sideOffset={8} className="block w-72 p-4">
        <p className="font-semibold">Ultimi dati disponibili</p>
        {freshness === null ? <p className="mt-3 text-background/70">Caricamento…</p> : <div className="mt-3 space-y-3">
          {items.map((item) => (
            <div key={item.id}>
              <p className="font-medium">{item.label}</p>
              <p className="mt-0.5 text-background/70">{formatFreshnessDate(item.ingestion?.finished_at)} · {formatFrequency(item.frequency)}</p>
            </div>
          ))}
        </div>}
        <p className="mt-3 border-t border-background/20 pt-3 text-background/70">Le fonti vengono controllate automaticamente.</p>
      </TooltipContent>
    </Tooltip>
  )
}

function formatFreshnessDate(value?: string | null) {
  if (!value) return "Data non disponibile"
  return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value))
}

function formatFrequency(value: string) {
  const frequencies: Record<string, string> = {
    daily: "aggiornamento giornaliero",
    monthly: "aggiornamento mensile",
    periodic: "aggiornamento periodico",
    irregular: "aggiornamento non programmato",
  }
  return frequencies[value] ?? "aggiornamento periodico"
}

function NavLink({ href, active, icon, children }: { href: string; active: boolean; icon?: ReactNode; children: ReactNode }) {
  return (
    <a
      href={href}
      aria-label={typeof children === "string" ? children : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex size-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors duration-200 sm:h-auto sm:w-auto sm:px-4 sm:py-2",
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <span className="inline-flex">{icon}</span>
      <span className="sr-only sm:not-sr-only">{children}</span>
    </a>
  )
}
