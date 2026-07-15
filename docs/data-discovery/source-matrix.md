# AIFA source matrix

Verification date: **2026-07-15**, Europe/Rome. All sources are public AIFA pages. AIFA declares the catalog data under **CC BY 4.0**: reuse, modification and commercial use are allowed with attribution. Personal data, if present, remain reusable only within applicable privacy law. The inspected medicine datasets contain organizations/products, not natural-person data.

| Source ID | Official page | Artifact URL observed | Discovery method | Format | Declared / observed frequency | Granularity | Candidate key | Authority | History | MVP |
|---|---|---|---|---|---|---|---|---|---|---|
| `aifa-transparency-list` | `https://www.aifa.gov.it/liste-di-trasparenza` | `https://www.aifa.gov.it/documents/20142/825643/Lista_farmaci_equivalenti.csv` | HTML link text + CSV preference; static override supported | CSV, Windows-1252, `;` | monthly / current page dated 2026-07-15 | official group membership per package, with price observations | AIC after 9-digit normalization; source group code | authoritative for official equivalence, membership and reference price | monthly ZIP archive, inspected 2025-01-15, 2026-03-16, 2026-04-15 | yes |
| `aifa-packages` | `https://www.aifa.gov.it/liste-dei-farmaci` | `https://drive.aifa.gov.it/farmaci/confezioni_fornitura.csv` | HTML link text/domain + static override | CSV, ASCII, `;` | previous day / `Last-Modified` 2026-07-14 | authorized package snapshot | `CODICE_AIC` (unique) | descriptive/provisional AIFA package register | none exposed on page | yes |
| `aifa-package-ingredients` | same | `https://drive.aifa.gov.it/farmaci/PA_confezioni.csv` | HTML link + static override | CSV, ASCII, `;` | previous day / 2026-07-14 | one active-substance row per package, sometimes multiple | no single key; AIC + source row ordinal | descriptive/provisional AIFA relation | none exposed | yes |
| `aifa-atc` | same | `https://drive.aifa.gov.it/farmaci/atc.csv` | HTML link + static override | CSV, ASCII, `;` | previous day / 2026-07-14 | ATC concept at several hierarchy levels | `CODICE_ATC` (unique) | AIFA publication of ATC terminology | none exposed | yes |
| `aifa-shortages` | `https://www.aifa.gov.it/farmaci-carenti` | current CSV plus `https://www.aifa.gov.it/documents/20142/1864033/archivio_carenze_2025.zip` | HTML link text “Elenco farmaci carenti” + CSV/year archive | current CSV Windows-1252; historical XLSX in ZIP | periodic / current file dated 2026-07-14; 100 complete-list snapshots in 2025 | current shortage state/episode per AIC and start date | AIC is not unique; AIC + start date + row fingerprint | authoritative for shortage declarations, not equivalence | yearly ZIP archives 2018–2025; 2025 inspected | no (API scaffolded) |
| `aifa-class-a` | `https://www.aifa.gov.it/liste-farmaci-a-h` | `.../Classe_A_per_{principio_attivo,nome_commerciale}_28-02-2026.csv` | link text + class/order + CSV | CSV, Windows-1252, `;` | irregular; page/file metadata inconsistent | marketed class-A package in prescription grouping | AIC (unique) | authoritative for class-A list; not official substitutability | no archive exposed | no |
| `aifa-class-h` | same | `.../Classe_H_per_{principio_attivo,nome_commerciale}_28-02-2026.csv` | link text + class/order + CSV | CSV, Windows-1252, `;`; quoted header contains newline | irregular | marketed class-H package in prescription grouping | AIC (unique) | authoritative for class-H list; not official substitutability | no archive exposed | no |
| `aifa-open-data-index` | `https://www.aifa.gov.it/open-data` | n/a | HTML catalog navigation | HTML | not declared | catalog/licensing document | URL | authoritative licensing index | no | evidence only |
| `aifa-medicines-portal` | `https://medicinali.aifa.gov.it/` | n/a | manual verification only | web UI | current | medicine/package display and official documents | AIC/search | verification source only | no public stable API contract found | no pipeline dependency |

The index page and HTTP metadata can disagree with filenames (the class A/H page showed newer update metadata while artifacts retain `28-02-2026`). Consequently, publication date is evidence with confidence, not inferred solely from the filename.

## Observed artifact hashes

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| [transparency current](https://www.aifa.gov.it/documents/20142/825643/Lista_farmaci_equivalenti.csv) | 1,741,268 | `b84a0471f93f0bd8f469da10476dd9138be2c35dd27fbab7af240e9ac9365bcd` |
| [packages](https://drive.aifa.gov.it/farmaci/confezioni_fornitura.csv) | 82,381,940 | `f8cee096705b51e25add493ad698671c7107f90dee825f095ec7749c5f5befdc` |
| [package ingredients](https://drive.aifa.gov.it/farmaci/PA_confezioni.csv) | 11,543,496 | `1ff88f43d1e060935232df5237b63758bec2ddd85e2601f542993955644a20a9` |
| [ATC](https://drive.aifa.gov.it/farmaci/atc.csv) | 198,401 | `5ca623359301f79fead225aa7e4953b20af8d437daa071b50df21ccbcb29ca9a` |
| [shortages](https://www.aifa.gov.it/documents/20142/847339/elenco_medicinali_carenti.csv) | 884,824 | `dfb33dcbfe3492cf8f5d250d0a66ccfaec31dd227565e445af016ccd7887689d` |
| [class A by active substance](https://www.aifa.gov.it/documents/20142/3815901/Classe_A_per_principio_attivo_28-02-2026.csv) | 1,496,599 | `b365f0a3b0d37abaebf807927ef552c9d46838ba399e8c8765fb7e4e966133e8` |
| [class A by name](https://www.aifa.gov.it/documents/20142/3815901/Classe_A_per_nome_commerciale_28-02-2026.csv) | 1,496,599 | `737e180c7a9d10f171d28ba7809f9d41c089a8f13b79b9b2677e0b1285ba9d98` |
| [class H by active substance](https://www.aifa.gov.it/documents/20142/3815901/Classe_H_per_principio_attivo_28-02-2026.csv) | 384,540 | `15051349623ce14f9df587f5f047960c50c40338aaccadc23585f02f69cf36ac` |
| [class H by name](https://www.aifa.gov.it/documents/20142/3815901/Classe_H_per_nome_commerciale_28-02-2026.csv) | 384,540 | `38cdfb881a7f31edccff82b96169a32e67123e3472927943ec72c03b64b90b49` |
| [transparency archive 2026-04-15](https://www.aifa.gov.it/documents/20142/825643/2026-04-15_liste_farmaci_equivalenti.zip) | 6.6 MiB | `0a0044f0b33b8ad6de8b114483792e6047af1b98044f0492e6c9775b8062aaa2` |
| [transparency archive 2026-03-16](https://www.aifa.gov.it/documents/20142/825643/2026-03-16_liste_farmaci_equivalenti.zip) | 6.3 MiB | `81751aba93409749ba2817bc47cd685c1b7382b2e2c5a82f323405d0fa4b2f12` |
| [transparency archive 2025-01-15](https://www.aifa.gov.it/documents/20142/825643/2025-01-15_liste_farmaci_equivalenti.zip) | 6.4 MiB | `3c15421949816a2e74c00410b139ab36da31eaffadfea932d84ea069573bbae5` |
| [shortage archive 2025](https://www.aifa.gov.it/documents/20142/1864033/archivio_carenze_2025.zip) | 88,083,779 | `25bccaaaaceabef8ac758d0d7035b91c9bfe5f44196c9edb2452eea02d45dd78` |
