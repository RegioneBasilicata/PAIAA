# PAIAA — Percorso di governance dell’IA nella PA — versione 4.0.0-wip.9 - BETA

Lo strumento supporta censimento, valutazione, evidenze, validazioni, decisioni e monitoraggio dei casi d’uso. 
Gli esiti richiedono istruttoria e responsabilità umana: non costituiscono certificazioni o provvedimenti automatici.

PAIAA — versione 4.0.0-wip.9 - BETA 
Copyright (c) 2026 Regione Basilicata, per il codice originale 
Concesso in licenza a norma dell’EUPL, versione 1.2 
Il testo integrale è nel file LICENSE 
I componenti di terzi conservano licenze e attribuzioni proprie: vedere THIRD_PARTY_NOTICES.md e LICENSES 

## Avvio locale da sorgenti

Occorre Node.js `>=24.13.0 <25`; verificato con `24.22.2`. Il runtime non ha
dipendenze npm: nessuna build del frontend, database esterno o CDN richiesto.
Eseguire dalla directory estratta:

```sh
mkdir -p .local/data
chmod 700 .local .local/data
openssl rand -base64 32 > .local/bootstrap-password
chmod 600 .local/bootstrap-password
HOST=127.0.0.1 PORT=18784 AIGH_DATA_DIR="$PWD/.local/data" AIGH_ADMIN_PASSWORD_FILE="$PWD/.local/bootstrap-password" node server/server.js
```

Aprire `http://127.0.0.1:18784`, utente `admin`, password nel file locale protetto.
Non allegare quel file alle issue e non caricarlo nel repository. La password
inizializza soltanto un database vuoto; per modificarla dopo usare la gestione
utenti. Senza credenziali esplicite il primo avvio fallisce. Il server non le stampa.
Se la porta è occupata, sceglierne un’altra. Arresto: `Ctrl+C`.

La demo offline accessibile da `index.html` usa archivi del browser e account
dimostrativi: non è il backend autenticato e non va usata con dati reali. Non
trasferire archivi tra demo, enti o installazioni senza verifica del formato.

## Docker locale

```sh
cp .env.example .env
# Inserire in .env una password iniziale robusta, poi:
chmod 600 .env
docker compose up --build -d
docker compose ps
```

Il Compose minimo pubblica solo `127.0.0.1:18784` e usa un volume con nome derivato
dal progetto. Per un’istanza distinta: `docker compose -p nome_distinto ...` e
porta diversa in `.env`. Non contiene reti, nomi container o volumi dell’ente
originario. Non eseguire `down -v` su dati da conservare.

Per esercizio con utenti reali occorrono una configurazione TLS/proxy coerente con
`AIGH_PUBLIC_ORIGIN`, gestione account, backup, retention, controllo accessi e
validazione dell’ente. Gli header forwarded non sostituiscono l’origine esplicita.
Vedere [esercizio e dati](docs/ESERCIZIO.md).

## Verifica e sviluppo

```sh
npm test
# Solo per gli strumenti browser e l’audit delle dipendenze di sviluppo:
npm ci --ignore-scripts
npm audit --audit-level=high
```

La suite corrente controlla sintassi, dominio, API e isolamento con dati sintetici.
Il workflow GitHub incluso esegue i test, l’audit npm e la build Docker senza
pubblicare immagini. La sua esecuzione remota non è stata effettuata durante la
preparazione del pacchetto. I test non equivalgono a un collaudo completo di
accessibilità, sicurezza o conformità amministrativa.

Struttura: `assets/` interfaccia e moduli condivisi, `server/` HTTP/sessioni/SQLite,
`tests/` suite corrente e fixture sintetiche, `docker/` immagine, `LICENSES/` avvisi
dei componenti di terzi. Il codice applicativo non richiede servizi del fornitore.

## Contenuti della distribuzione minima

Le fonti normative restano nel catalogo come collegamenti ufficiali. Le copie
PDF/DOCX/ZIP e il template XLSX del progetto originale non sono distribuiti perché
i relativi diritti non sono stati comprovati. Le funzioni regionali restano nel
codice, con applicabilità da motivare per ogni ente; non è stato sostituito il
metodo di valutazione. La consultazione delle fonti esterne richiede rete.

Sono esclusi dati operativi, `.env`, log, database, audit interni, dipendenze
installate, storici di pacchetto e configurazioni personali degli agenti. Il vecchio
generatore PDF AcroForm, soggetto a troncamento e perdita di caratteri, non è
caricato né distribuito: l’editor offre HTML e stampa del browser, senza promessa
di PDF accessibile o firmato automaticamente.

Vedere [componenti e licenze](THIRD_PARTY_NOTICES.md), [contributi](CONTRIBUTING.md)
e [sicurezza](SECURITY.md).
