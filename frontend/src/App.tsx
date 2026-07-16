import { useEffect } from "react"
import { AppShell } from "@/components/app-shell"
import { ComparePage } from "@/pages/compare-page"
import { DashboardPage } from "@/pages/dashboard-page"

function App() {
  const isCompare = window.location.pathname === "/compare" || window.location.pathname.startsWith("/compare/")

  useEffect(() => {
    document.title = isCompare ? "Confronta AIC · MedData" : "MedData · Catalogo medicinali AIFA"
  }, [isCompare])

  return <AppShell activePage={isCompare ? "compare" : "dashboard"}>{isCompare ? <ComparePage /> : <DashboardPage />}</AppShell>
}

export default App
