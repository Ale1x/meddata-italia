# AIFA class A/H dictionary

Granularity: one marketed class-A or class-H package in a prescription grouping. The principle/name variants contain identical record sets with different order. Class A: 10,617 rows; class H: 2,407. AIC is unique. These groups are not the official transparency equivalence semantic.

| Original | Normalized | Type → canonical | A null/distinct | H null/distinct | Target / notes |
|---|---|---|---:|---:|---|
| Principio Attivo | `principio_attivo` | text | 0 / 852 | 0 / 606 | classification evidence |
| Descrizione Gruppo | `descrizione_gruppo` | text | 0 / 2,602 | 0 / 1,291 | prescription group label, not official equivalence |
| Denominazione e Confezione | `denominazione_e_confezione` | text | 0 / 6,578 | 0 / 1,950 | package display |
| Prezzo al pubblico € | `prezzo_al_pubblico` | locale money | 0 / 2,511 | 31 / 1,282 | temporal price observation |
| Prezzo Ex-factory € | `prezzo_ex_factory` | locale money | absent | 26 / 1,258 | H only |
| Prezzo massimo di cessione € | `prezzo_massimo_di_cessione` | locale money | absent | 2,389 / 5 | H only |
| Titolare AIC | `titolare_aic` | text | 0 / 438 | 0 / 322 | holder observation |
| AIC / Codice newline AIC | `aic` / `codice_aic` | char(9) | 0 / 10,617 | 0 / 2,407 | unique package join; H header normalized quote-aware |
| Codice Gruppo Equivalenza | `codice_gruppo_equivalenza` | char(3) | 0 / 2,605 | 0 / 1,296 | source calls it equivalence but page semantics explicitly differ from transparency |
| X=in lista di trasparenza… | semantic `in_transparency` | marker | 2,276 / 1 | absent | membership evidence only; dated header |
| Solo in lista di Regione | `solo_in_lista_di_regione` | text | 10,561 / 3 | absent | A only |
| Metri cubi ossigeno | `metri_cubi_ossigeno` | decimal text | 10,257 / 38 | 2,274 / 27 | oxygen-specific measure |
