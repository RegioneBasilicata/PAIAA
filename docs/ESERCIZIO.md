# Esercizio e dati

## Configurazione letta all’avvio

| Variabile | Uso | Segreto |
|---|---|---|
| `HOST` | Default `127.0.0.1`; fuori loopback richiede origine esplicita | No |
| `PORT` | Default 8784; nel Compose interno 8784, esterno 18784 | No |
| `AIGH_PUBLIC_ORIGIN` | Schema, host e porta esatti del browser, senza percorso | No |
| `AIGH_DATA_DIR` | Directory SQLite; default `server/data` | No, contenuto riservato |
| `AIGH_ADMIN_PASSWORD` | Primo account su DB vuoto, 12–256 caratteri | Sì |
| `AIGH_ADMIN_PASSWORD_FILE` | Alternativa al valore; file UTF-8, newline finale eliminata | Sì |
| `LOCAL_PORT` | Solo Compose minimo, bind loopback | No |

Precedenza bootstrap: opzione programmatica, variabile password, file password.
Non impostare password e file contemporaneamente. Nel container un percorso host
non diventa automaticamente leggibile: montare il file, con permessi adeguati,
oppure usare un secret del gestore. Non registrare valori segreti nei log.

## Persistenza e ripristino

Il backend usa SQLite (`governance.sqlite` e relativi WAL/SHM). Le istantanee delle
operazioni amministrative e delle modifiche a prove validate sono nel medesimo
database: non sono un backup esterno. Gli audit sono concatenati e append-only
nel DB; ciò non costituisce conservazione documentale a norma o protezione da un
amministratore dell’infrastruttura.

Per un backup a freddo arrestare ordinatamente la propria istanza, copiare l’intera
directory dati o il volume con accesso riservato, proteggere/cifrare la copia e
riavviare. Non copiare soltanto il file principale mentre il database è attivo.
Nel ripristino conservare proprietario e permessi: il container opera come utente
`node`, non come root; directory dati accessibile solo al proprietario (700) e
database riservato (600). Una copia tramite `docker cp` può assegnare proprietà
root: correggerla nel solo volume di destinazione prima dell’avvio, senza aprire
i permessi a tutti. Provare il ripristino in una nuova directory/volume, usando la stessa versione
del codice; verificare login, casi, allegati, versioni e audit. RPO/RTO e retention
devono essere stabiliti dall’ente. Non cancellare volumi per aggiornare il codice.

Per aggiornare: backup verificato, prova su copia isolata, verifica compatibilità
e migrazioni, sostituzione del codice/immagine e collaudo. Un ritorno al codice
precedente può richiedere il ripristino coerente dei dati. Nessuna migrazione
operativa è stata eseguita nella preparazione di questa distribuzione.

## API e portabilità

API HTTP/JSON UTF-8 nello stesso dominio. `GET /healthz` restituisce `{ "ok": true }`.
`POST /api/login` richiede username/password; la sessione è in cookie HttpOnly
SameSite Strict, Secure con origine HTTPS. Le scritture richiedono Origin esatta,
cookie e `X-CSRF-Token`. `GET /api/workspace` restituisce workspace e revisione;
`PUT /api/workspace` richiede `If-Match` con quella revisione. I conflitti sono 409;
schema e vincoli applicativi possono restituire 422. Gli errori non vanno aggirati
reimportando arbitrariamente un archivio.

L’interfaccia offre esportazione/importazione dell’archivio JSON, con identità,
relazioni e allegati data URI. Prima di trasferire dati tra enti verificarne
necessità, contenuto, versione e titolarità. L’importazione amministrativa conserva
una copia e può riaprire verifiche secondo le regole implementate; non è un
protocollo nazionale di interoperabilità né un formato di conservazione.

Non sono configurati automaticamente SPID/CIE, SSO, MFA, un servizio email o un
SIEM. Il monitor delle fonti può effettuare richieste alle fonti ufficiali quando
abilitato dall’amministratore. Definire gli accessi di rete consentiti nell’ente.
