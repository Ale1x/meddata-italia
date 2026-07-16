export type CommonMedicine = {
  name: string
  aic: string
  description: string
  activeSubstance: string
  sourceLabel: string
  sourceUrl: string
  tone: "blue" | "lime" | "amber" | "violet" | "rose"
}

export const commonMedicines: CommonMedicine[] = [
  {
    name: "Tachipirina",
    aic: "012745093",
    description: "500 mg · 20 compresse",
    activeSubstance: "Paracetamolo",
    sourceLabel: "Ministero della Salute",
    sourceUrl: "https://www.salute.gov.it/new/sites/default/files/imported/C_17_bancheDati_14_5_0_file.pdf",
    tone: "blue",
  },
  {
    name: "OKi",
    aic: "028511095",
    description: "80 mg · 30 bustine bipartite",
    activeSubstance: "Ketoprofene sale di lisina",
    sourceLabel: "Gazzetta Ufficiale",
    sourceUrl: "https://www.gazzettaufficiale.it/atto/vediMenuHTML?atto.codiceRedazionale=22A03482&atto.dataPubblicazioneGazzetta=2022-06-14&tipoSerie=serie_generale&tipoVigenza=originario",
    tone: "lime",
  },
  {
    name: "Aspirina",
    aic: "041962034",
    description: "500 mg · 20 compresse rivestite",
    activeSubstance: "Acido acetilsalicilico",
    sourceLabel: "Gazzetta Ufficiale",
    sourceUrl: "https://www.gazzettaufficiale.it/atto/vediMenuHTML?atto.codiceRedazionale=26A03109&atto.dataPubblicazioneGazzetta=2026-07-01&tipoSerie=serie_generale&tipoVigenza=originario",
    tone: "amber",
  },
  {
    name: "Moment",
    aic: "025669223",
    description: "200 mg · 12 compresse orodispersibili",
    activeSubstance: "Ibuprofene",
    sourceLabel: "Gazzetta Ufficiale",
    sourceUrl: "https://www.gazzettaufficiale.it/atto/vediMenuHTML?atto.codiceRedazionale=24A05535&atto.dataPubblicazioneGazzetta=2024-10-23&tipoSerie=serie_generale&tipoVigenza=originario",
    tone: "violet",
  },
  {
    name: "Buscopan",
    aic: "006979025",
    description: "10 mg · 30 compresse rivestite",
    activeSubstance: "N-butilbromuro di scopolamina",
    sourceLabel: "Gazzetta Ufficiale",
    sourceUrl: "https://www.gazzettaufficiale.it/atto/vediMenuHTML?atto.codiceRedazionale=13A07189&atto.dataPubblicazioneGazzetta=2013-08-30&tipoSerie=serie_generale&tipoVigenza=originario",
    tone: "rose",
  },
]
