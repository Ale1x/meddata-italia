import { useState } from "react"
import { CheckCircle, WarningCircle } from "@phosphor-icons/react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export function AccessDisclaimerDialog() {
  const [open, setOpen] = useState(true)

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        // L'avviso richiede una conferma esplicita e non viene chiuso da Escape
        // o da un'interazione involontaria con lo sfondo.
        if (nextOpen) setOpen(true)
      }}
    >
      <AlertDialogContent className="max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] gap-5 overflow-y-auto p-5 sm:max-w-lg sm:p-6">
        <AlertDialogHeader className="place-items-start text-left">
          <AlertDialogMedia className="mb-1 size-11 rounded-xl bg-warning/12 text-warning">
            <WarningCircle size={26} weight="fill" />
          </AlertDialogMedia>
          <AlertDialogTitle className="font-display text-xl font-semibold tracking-[-0.02em] sm:text-2xl">
            Prima di consultare MedData
          </AlertDialogTitle>
          <AlertDialogDescription className="max-w-md text-left text-sm leading-6">
            Questo è un servizio informativo indipendente basato su dati pubblici. Non è un servizio medico, farmaceutico o di telemedicina.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="rounded-xl border border-warning/35 bg-warning/[0.06] p-4" role="note" aria-label="Limiti importanti del servizio">
          <ul className="space-y-3 text-sm leading-6 text-foreground">
            <DisclaimerItem>Non usare i risultati per scegliere, iniziare, interrompere o sostituire un medicinale.</DisclaimerItem>
            <DisclaimerItem>Lo stesso principio attivo o la presenza nello stesso raggruppamento AIFA non stabiliscono quale medicinale sia adatto a una persona.</DisclaimerItem>
            <DisclaimerItem>Verifica sempre confezione, prescrizione, dosaggio e possibili rischi con un medico o farmacista.</DisclaimerItem>
          </ul>
        </div>

        <p className="text-xs leading-5 text-muted-foreground">
          Continuando confermi di aver compreso questi limiti. Consulta i <a className="font-medium text-foreground underline underline-offset-4" href="/terms" target="_blank" rel="noreferrer">Termini di utilizzo</a> e la <a className="font-medium text-foreground underline underline-offset-4" href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>.
        </p>

        <AlertDialogFooter className="-mx-5 -mb-5 p-5 sm:-mx-6 sm:-mb-6 sm:p-6">
          <AlertDialogAction className="min-h-11 w-full cursor-pointer sm:w-auto" onClick={() => setOpen(false)}>
            Ho compreso, continua
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function DisclaimerItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <CheckCircle className="mt-1 shrink-0 text-warning" size={17} weight="fill" aria-hidden="true" />
      <span>{children}</span>
    </li>
  )
}
