import { useEffect, useState, type ReactNode } from "react"
import { ArrowUpRight, ArrowsLeftRight, Moon, Pill, Sun } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type AppShellProps = {
  activePage: "dashboard" | "compare"
  children: ReactNode
}

export function AppShell({ activePage, children }: AppShellProps) {
  const [dark, setDark] = useState(() => window.localStorage.getItem("meddata-theme") === "dark")

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark)
    window.localStorage.setItem("meddata-theme", dark ? "dark" : "light")
  }, [dark])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a className="skip-link" href="#main-content">Vai al contenuto</a>
      <header className="sticky top-0 z-50 px-3 pt-3 sm:px-5">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between rounded-2xl border bg-background/92 px-3 shadow-[var(--shadow-soft)] backdrop-blur-xl sm:px-5">
          <a href="/" className="flex cursor-pointer items-center gap-2.5 rounded-lg focus-visible:ring-2 focus-visible:ring-ring">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[var(--shadow-soft)]">
              <Pill size={19} weight="fill" />
            </span>
            <span className="hidden font-display text-[17px] font-semibold tracking-[-0.02em] sm:inline">MedData</span>
          </a>

          <nav aria-label="Navigazione principale" className="flex items-center gap-1 rounded-xl bg-muted/70 p-1">
            <NavLink href="/" active={activePage === "dashboard"}>Catalogo</NavLink>
            <NavLink href="/compare" active={activePage === "compare"} icon={<ArrowsLeftRight size={15} />}>Confronta</NavLink>
            <a href="https://api.health.passarelli.dev/docs" target="_blank" rel="noreferrer" className="hidden cursor-pointer items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground md:flex">API <ArrowUpRight size={13} /></a>
          </nav>

          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-2 text-xs font-medium text-muted-foreground lg:flex">
              <span className="size-2 rounded-full bg-primary shadow-[0_0_0_4px_color-mix(in_srgb,var(--primary)_12%,transparent)]" />
              Dati AIFA
            </span>
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

function NavLink({ href, active, icon, children }: { href: string; active: boolean; icon?: ReactNode; children: ReactNode }) {
  return (
    <a
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 sm:px-4",
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <span className="hidden sm:inline-flex">{icon}</span>
      {children}
    </a>
  )
}
