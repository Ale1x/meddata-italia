import { ArrowLeft, FileText, Info } from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { SafetyNotice } from "@/components/safety-notice"

export function TermsPage() {
  return (
    <LegalLayout title="Termini di utilizzo" description="Condizioni, limiti e criteri applicabili all’uso di MedData." icon={<FileText size={16} />}>
      <SafetyNotice />
      <LegalSection title="1. Natura del servizio">
        <p>MedData è un progetto informativo, gratuito e open source che organizza dati pubblici relativi a medicinali e confezioni. Non è una farmacia, una parafarmacia, una struttura sanitaria o un servizio di telemedicina. Non vende, prenota o consegna medicinali e non contiene collegamenti di acquisto o affiliazione commerciale.</p>
        <p>Le denominazioni commerciali sono mostrate esclusivamente perché presenti nelle fonti consultate, senza sponsorizzazioni, posizionamenti a pagamento o intenzione di promuovere prescrizione, fornitura, vendita o consumo.</p>
      </LegalSection>
      <LegalSection title="2. Nessuna affiliazione istituzionale">
        <p>MedData è un progetto indipendente. Non è gestito, approvato, certificato o sponsorizzato dall’Agenzia Italiana del Farmaco, dal Ministero della Salute, dal Servizio Sanitario Nazionale o da altre autorità pubbliche. I nomi delle fonti indicano esclusivamente la provenienza dei dati.</p>
      </LegalSection>
      <LegalSection title="3. Nessun consiglio medico o farmaceutico">
        <p>I contenuti non costituiscono diagnosi, prescrizione, consiglio medico, consiglio farmaceutico o raccomandazione d’uso. Non devono essere utilizzati per scegliere, iniziare, interrompere, modificare o sostituire una terapia. In caso di dubbi, patologie, gravidanza, allergie, interazioni, effetti indesiderati o urgenze, rivolgersi a un professionista sanitario o ai servizi di emergenza.</p>
      </LegalSection>
      <LegalSection title="4. Raggruppamenti della Lista di trasparenza">
        <p>Quando due confezioni risultano nello stesso raggruppamento, il servizio riporta esclusivamente una co-appartenenza osservata nello snapshot indicato della Lista di trasparenza AIFA. Il risultato non valuta il caso clinico, gli eccipienti, la prescrizione, la disponibilità locale o le disposizioni regionali. L’assenza di una confezione dalla lista non dimostra che essa non sia equivalente ad altre confezioni.</p>
      </LegalSection>
      <LegalSection title="5. Principio attivo e composizione">
        <p>La presenza dello stesso principio attivo, dello stesso codice ATC o di un dosaggio simile è un’informazione descrittiva. Non dimostra bioequivalenza, equivalenza terapeutica, intercambiabilità o sostituibilità. Le associazioni di sostanze, le forme farmaceutiche, le vie di somministrazione, i dosaggi e gli eccipienti possono differire.</p>
      </LegalSection>
      <LegalSection title="6. Prezzo di riferimento">
        <p>Gli importi provenienti dalla Lista di trasparenza sono presentati come prezzi di riferimento o limiti di rimborso SSN della categoria omogenea alla data indicata. Non rappresentano necessariamente il prezzo al pubblico, l’importo effettivamente pagato o la disciplina applicabile in ogni regione.</p>
      </LegalSection>
      <LegalSection title="7. Fonti, aggiornamento e qualità dei dati">
        <p>I dati possono essere provvisori, incompleti, corretti o aggiornati dalle rispettive fonti in momenti diversi. MedData conserva data di osservazione e provenienza, ma non garantisce continuità, completezza, esattezza o aggiornamento in tempo reale. Prima di assumere decisioni, verificare la confezione, il foglio illustrativo, la prescrizione e le fonti istituzionali correnti.</p>
        <p>I dati AIFA sono riutilizzati con attribuzione secondo la licenza indicata dalla fonte, attualmente CC BY 4.0. Il codice del progetto è disponibile su <a href="https://github.com/Ale1x/meddata-italia" target="_blank" rel="noreferrer">GitHub</a>.</p>
      </LegalSection>
      <LegalSection title="8. Uso consentito">
        <p>È vietato usare il servizio per sostituirsi a professionisti sanitari, costruire raccomandazioni cliniche automatiche, effettuare attività illecite, eludere limiti tecnici o sovraccaricare l’infrastruttura. L’API è soggetta a limiti di traffico e può cambiare nelle successive versioni.</p>
      </LegalSection>
      <LegalSection title="9. Responsabilità e disponibilità">
        <p>Nei limiti consentiti dalla legge, il servizio è fornito nello stato in cui si trova e può essere sospeso, corretto o modificato. Nulla in questi termini esclude responsabilità che non possono essere escluse per legge. L’utente resta responsabile della verifica delle informazioni e del coinvolgimento di un professionista sanitario.</p>
      </LegalSection>
      <LegalSection title="10. Segnalazioni, modifiche e legge applicabile">
        <p>Errori o contenuti potenzialmente fuorvianti possono essere segnalati a <a href="mailto:alessandro@passarelli.dev">alessandro@passarelli.dev</a>. I termini possono essere aggiornati; la data della versione è riportata in fondo. Si applica la legge italiana, fatti salvi i diritti inderogabili e il foro eventualmente previsto a tutela del consumatore.</p>
      </LegalSection>
      <p className="border-t pt-5 text-xs text-muted-foreground">Versione del 16 luglio 2026. Una revisione professionale indipendente resta raccomandata per ogni utilizzo pubblico o commerciale del servizio.</p>
    </LegalLayout>
  )
}

export function LegalLayout({ title, description, icon, children }: { title: string; description: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="px-5 pb-12 pt-12 lg:px-8 lg:pt-18">
      <div className="mx-auto max-w-4xl">
        <a href="/" className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft size={16} /> Torna al catalogo</a>
        <div className="mt-8">
          <Badge variant="secondary">{icon} Informazioni legali</Badge>
          <h1 className="mt-5 font-display text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">{description}</p>
        </div>
        <Card className="mt-9">
          <CardContent className="space-y-8 p-6 sm:p-9">{children}</CardContent>
        </Card>
      </div>
    </div>
  )
}

function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-3 [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_p]:text-sm [&_p]:leading-7 [&_p]:text-muted-foreground"><h2 className="flex items-center gap-2 font-display text-xl font-semibold"><Info size={18} className="text-primary" />{title}</h2>{children}</section>
}
