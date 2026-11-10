# Componenti di terzi

Il codice originale ha come titolare indicato dall’utente **Regione Basilicata**;
la licenza EUPL-1.2 è stata approvata dall’utente il 9 novembre 2026. Questo non modifica le licenze dei terzi.

| Componente distribuito | Versione | Condizioni e attribuzioni |
|---|---|---|
| Plotly gl3d | 3.1.0 | MIT, Plotly; `LICENSES/Plotly-MIT.txt` e avvisi incorporati |
| Bootstrap Italia CSS | 2.18.3 | BSD-3-Clause; `LICENSES/Bootstrap-Italia-BSD-3-Clause.txt` e `Bootstrap-Italia-AUTHORS.txt` |
| Bootstrap incorporato nel CSS | 5.2.3 | MIT; `LICENSES/Bootstrap-MIT.txt` |
| Titillium Web, quattro WOFF2 | v10, dal pacchetto Bootstrap Italia 2.18.3 | OFL-1.1, Accademia di Belle Arti di Urbino e studenti; `LICENSES/Titillium-Web-OFL-1.1.txt` |

I font e il bundle Plotly sono identici byte per byte ai file dei pacchetti npm
ufficiali delle versioni indicate. Il CSS coincide dopo rimozione del BOM e del
commento sourceMappingURL. Non sono state sostituite le intestazioni di licenza.
Impronte, provenienza e verifica del 9 novembre 2026: `LICENSES/asset-provenance.json`.

`LICENSES/Plotly-bundled-notices.txt` riproduce gli avvisi estratti dal bundle.
Per buffer, ieee754, is-buffer, pad-left, repeat-string, polybooljs e object-assign
sono aggiunti i testi dai pacchetti di riferimento elencati in
`LICENSES/bundled-license-sources.json`; per native-promise-only è incluso il testo
MIT pubblicato da Kyle Simpson al collegamento richiamato nel suo sorgente
(`https://getify.mit-license.org/`). I testi sono supplementari: gli avvisi originali
restano nel bundle. Le versioni di riferimento non costituiscono identificazione
indipendente di ogni componente minificato. Una SBOM completa delle dipendenze
incorporate e la validazione giuridica della distribuzione restano da completare.

Playwright 1.62.1 e axe-core 4.14.0 sono strumenti di sviluppo, bloccati nel
lockfile, rispettivamente Apache-2.0 e MPL-2.0. `node_modules` e browser non sono
distribuiti nell’archivio. Il runtime usa i moduli integrati di Node.js; l’immagine
Docker scarica Node e il sistema base con le rispettive licenze, non inclusi qui.

I documenti di riferimento PDF/DOCX/ZIP e il template XLSX originali non sono
inclusi nel pacchetto minimo. I link ufficiali e le informazioni di provenienza
non attestano che i documenti siano vigenti o liberamente redistribuibili.
