import { useEffect } from "react"
import { AppShell } from "@/components/app-shell"
import { ComparePage } from "@/pages/compare-page"
import { DashboardPage } from "@/pages/dashboard-page"
import { SearchPage } from "@/pages/search-page"
import { PrivacyPage } from "@/pages/privacy-page"
import { TermsPage } from "@/pages/terms-page"

function App() {
  const isCompare = window.location.pathname === "/compare" || window.location.pathname.startsWith("/compare/")
  const isSearch = window.location.pathname === "/search" || window.location.pathname.startsWith("/search/")
  const isPrivacy = window.location.pathname === "/privacy"
  const isTerms = window.location.pathname === "/terms"

  useEffect(() => {
    document.title = isPrivacy ? "Privacy Policy · MedData" : isTerms ? "Termini di utilizzo · MedData" : isCompare ? "Confronta raggruppamenti AIFA · MedData" : isSearch ? "Cerca confezioni · MedData" : "MedData · Dati pubblici sui medicinali"
  }, [isCompare, isPrivacy, isSearch, isTerms])

  const activePage = isCompare ? "compare" : isSearch ? "search" : isPrivacy || isTerms ? "legal" : "dashboard"
  const page = isPrivacy ? <PrivacyPage /> : isTerms ? <TermsPage /> : isCompare ? <ComparePage /> : isSearch ? <SearchPage /> : <DashboardPage />

  return <AppShell activePage={activePage}>{page}</AppShell>
}

export default App
