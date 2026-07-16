import { LockKey } from "@phosphor-icons/react"
import { LegalLayout } from "@/pages/terms-page"

export function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" description="Informazioni sul trattamento dei dati tecnici durante l’uso del sito e dell’API." icon={<LockKey size={16} />}>
      <PrivacySection title="1. Titolare e contatti">Il servizio è gestito da Alessandro Passarelli. Per richieste relative alla privacy: <a href="mailto:alessandro@passarelli.dev">alessandro@passarelli.dev</a>.</PrivacySection>
      <PrivacySection title="2. Dati trattati">MedData non richiede registrazione e non raccoglie intenzionalmente dati sanitari, prescrizioni o profili clinici. Durante l’accesso possono essere trattati indirizzo IP, data e ora, URL richiesto, user agent, intestazioni tecniche, identificativi di richiesta, esito e durata della risposta. Le ricerche per nome o AIC/MINSAN transitano nei sistemi tecnici: non inserire nomi di persone, diagnosi o altre informazioni personali nei campi di ricerca.</PrivacySection>
      <PrivacySection title="3. Finalità e base giuridica">I dati tecnici sono trattati per erogare il servizio, prevenire abusi, applicare limiti di traffico, diagnosticare malfunzionamenti e proteggere l’infrastruttura. La base giuridica è il legittimo interesse alla sicurezza e al funzionamento del servizio, ai sensi dell’articolo 6, paragrafo 1, lettera f) del GDPR.</PrivacySection>
      <PrivacySection title="4. Conservazione">L’applicazione non crea un archivio permanente delle ricerche né profili degli utenti. I log tecnici sono soggetti a rotazione e vengono conservati per il tempo necessario a sicurezza, diagnosi e gestione degli abusi, salvo obblighi di legge o necessità di accertamento di illeciti. Non vengono utilizzati per pubblicità o profilazione sanitaria.</PrivacySection>
      <PrivacySection title="5. Fornitori e trasferimenti">Il sito utilizza Cloudflare per DNS, protezione, distribuzione del frontend e instradamento dell’API. Cloudflare può trattare dati tecnici come responsabile o autonomo titolare secondo i propri termini e le garanzie applicabili ai trasferimenti internazionali. Il backend opera su infrastruttura privata nell’Unione europea. Consulta anche la <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noreferrer">Privacy Policy di Cloudflare</a>.</PrivacySection>
      <PrivacySection title="6. Cookie e memoria locale">MedData non installa cookie pubblicitari e non utilizza strumenti di analytics o profilazione. La preferenza del tema chiaro o scuro viene salvata esclusivamente nel local storage del browser e può essere eliminata cancellando i dati del sito.</PrivacySection>
      <PrivacySection title="7. Comunicazione e diffusione">I dati tecnici non vengono venduti. Possono essere comunicati ai fornitori infrastrutturali, alle autorità quando previsto dalla legge o a soggetti necessari alla tutela del servizio. Le ricerche non sono pubblicate dal servizio.</PrivacySection>
      <PrivacySection title="8. Diritti">Nei casi previsti dal GDPR puoi chiedere accesso, rettifica, cancellazione, limitazione, opposizione e portabilità, oltre a proporre reclamo al Garante per la protezione dei dati personali. Per esercitare i diritti utilizza il contatto indicato sopra.</PrivacySection>
      <PrivacySection title="9. Minori e decisioni automatizzate">Il servizio non è progettato per raccogliere dati di minori e non adotta decisioni automatizzate con effetti giuridici o clinici sugli utenti.</PrivacySection>
      <PrivacySection title="10. Aggiornamenti">Questa informativa può cambiare in seguito a modifiche tecniche o normative. La versione corrente è datata 16 luglio 2026.</PrivacySection>
    </LegalLayout>
  )
}

function PrivacySection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-3 [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4"><h2 className="font-display text-xl font-semibold">{title}</h2><p className="text-sm leading-7 text-muted-foreground">{children}</p></section>
}
