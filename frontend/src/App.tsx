import { useEffect } from "react"
import { AppShell } from "@/components/app-shell"
import { ComparePage } from "@/pages/compare-page"
import { DashboardPage } from "@/pages/dashboard-page"
import { SearchPage } from "@/pages/search-page"

function App() {
  const isCompare = window.location.pathname === "/compare" || window.location.pathname.startsWith("/compare/")
  const isSearch = window.location.pathname === "/search" || window.location.pathname.startsWith("/search/")

  useEffect(() => {
    document.title = isCompare ? "Confronta AIC/MINSAN · MedData" : isSearch ? "Cerca farmaci · MedData" : "MedData · Catalogo medicinali AIFA"
  }, [isCompare, isSearch])

  const activePage = isCompare ? "compare" : isSearch ? "search" : "dashboard"
  const page = isCompare ? <ComparePage /> : isSearch ? <SearchPage /> : <DashboardPage />

  return <AppShell activePage={activePage}>{page}</AppShell>
}

export default App
