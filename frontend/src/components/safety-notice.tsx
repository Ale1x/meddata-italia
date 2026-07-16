import { WarningCircle } from "@phosphor-icons/react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { cn } from "@/lib/utils"

export function SafetyNotice({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <Alert className={cn("border-warning/40 bg-warning/[0.06] px-4 py-3", className)}>
      <WarningCircle className="text-warning" weight="fill" />
      <AlertTitle>Informazione, non indicazione terapeutica</AlertTitle>
      <AlertDescription>
        {compact
          ? "Non usare questi dati per iniziare, interrompere o sostituire un medicinale. Verifica sempre con medico o farmacista."
          : "Il servizio descrive dati pubblicati dalle fonti indicate. Non stabilisce quale medicinale sia adatto a una persona e non deve essere usato per iniziare, interrompere o sostituire una terapia. Verifica sempre confezione, prescrizione e indicazioni con un medico o farmacista."}
      </AlertDescription>
    </Alert>
  )
}
