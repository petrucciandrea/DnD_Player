# DnD_Player

Scheda personaggio interattiva per giocare a **Dungeons & Dragons 5e** (regole del 2014), pensata per stare aperta sul tavolo durante la sessione. Non si limita a mostrare i numeri: applica le regole. Tiri, danni, slot, riposi, concentrazione e tiri salvezza contro morte si gestiscono dalla scheda, che aggiorna lo stato del personaggio.

L'obiettivo è una piattaforma che possa usare chiunque: ci si registra, si tengono più personaggi e i dati stanno in un database. Le regole coprono le **12 classi** del Manuale del Giocatore, con razze, sottorazze e background, e una procedura guidata crea nuovi personaggi. Il personaggio di riferimento è **Alston il Breve**, Gnomo delle Rocce, Mago della Scuola di Divinazione.

## Dadi fisici o dadi dell'app

Ogni tiro apre la stessa finestra, e ogni volta scegli tu:

- **Tira l'app**: il risultato lo genera l'app.
- **Usa i miei risultati**: tiri i tuoi dadi al tavolo e inserisci i valori. Il modificatore si aggiunge da solo. Per i danni con più dadi puoi inserire anche solo il totale.

Sui d20 scegli **normale, vantaggio o svantaggio**. Con vantaggio o svantaggio si tirano due d20 e l'app tiene quello giusto.

## Cosa trovi nella scheda

### Intestazione

- **Punti Ferita**, con i pulsanti *Danno*, *Cura* e *Temp*. Il danno consuma prima i PF temporanei.
- **Classe Armatura, iniziativa, velocità, bonus di competenza, CD e attacco degli incantesimi**, tutti calcolati dai punteggi e dal livello.
- **Dadi Vita** rimasti, **Ispirazione** (on/off) e **Percezione passiva**.
- **Concentrazione**: mostra l'incantesimo che stai mantenendo. Quando subisci danni l'app chiede il TS su COS (CD 10 o metà del danno, il valore più alto). Se fallisce, la concentrazione si interrompe.
- **A 0 PF** la card dei PF mostra i **tiri salvezza contro morte**: 10+ è un successo, un 1 conta come due fallimenti, un 20 ti riporta a 1 PF. Subire danni a 0 PF conta come un fallimento. Se il danno oltre lo 0 raggiunge i PF massimi, la morte è istantanea. Successi e fallimenti si possono correggere a mano.
- **Riposo lungo**: riporta PF e slot al massimo e recupera metà dei Dadi Vita; per il mago divinatore ritira il Presagio, per il mago rende di nuovo disponibile il Recupero Arcano. Serve almeno 1 PF.
- **Riposo breve**: un pannello in cui imposti la durata e spendi i Dadi Vita uno alla volta. Puoi aggiungere il Canto di Riposo di un bardo del gruppo, scegliere gli slot da recuperare con il Recupero Arcano e, se sei stabilizzato a 0 PF, tirare il d4 per il recupero di 1 PF. Il pannello mostra l'anteprima dei PF, e nulla viene applicato finché non premi *Completa riposo*.
- **Esporta / Importa JSON**, **Personaggi** (torna all'elenco), il tuo **nome utente** (apre le impostazioni dell'account) ed **Esci**.
- **Stato del salvataggio**: *Salvata*, *Salvataggio…* oppure *Offline* se il database non è raggiungibile.

### Statistiche (& Presagio)

- Caratteristiche, tiri salvezza e le 18 abilità: basta un clic per tirare. Per gli gnomi, i TS di INT, SAG e CAR ricordano l'**Astuzia Gnomesca**.
- **Armi**: il tiro per colpire propone subito i danni, a una o a due mani per le armi versatili. Con un 20 naturale i dadi dei danni raddoppiano, il modificatore no.
- **Presagio** (solo Scuola di Divinazione): i d20 da usare al posto di un tiro (2d20, che diventano 3d20 dal 14° livello), da segnare come usati.
- **Tira dadi rapido**: d4, d6, d8, d10, d12, d20.
- Con **Modifica** cambi i punteggi di caratteristica e le competenze nelle abilità. I PF massimi si ricalcolano quando cambia la COS.

### Grimorio

- La tab compare solo a chi ha incantesimi (per classe o per razza).
- **Slot incantesimo** per livello, da spendere o recuperare con un clic. I massimi seguono la tabella della classe: incantatori completi, mezzi incantatori, terzi incantatori e slot del patto del Warlock, che si recuperano anche con il riposo breve.
- **Preparazione**: per chi prepara gli incantesimi (Chierico, Druido, Mago, Paladino) l'app fa rispettare il limite; per chi li conosce (Bardo, Ranger, Stregone, Warlock) conta quelli conosciuti. Tiene anche il conto dei trucchetti.
- Cliccando un incantesimo si apre la sua **scheda**: gittata, componenti, durata, concentrazione, rituale e descrizione. Da lì lo **lanci**:
  - con uno slot di livello pari o superiore, se è preparato;
  - come **rituale**, senza spendere slot, anche se non è preparato;
  - come trucchetto, senza slot.

  Il lancio spende lo slot, imposta la concentrazione se serve e propone i tiri per colpire (uno per raggio, come in *Raggio Rovente*) e i danni. I danni **scalano** con lo slot usato, o con il livello del personaggio per i trucchetti. Un 1 naturale manca il bersaglio, un 20 raddoppia i dadi. Negli incantesimi con tiro salvezza vedi la CD e la metà dei danni per chi lo supera.
- Puoi aggiungere o rimuovere incantesimi. Scrivendo il nome, l'app suggerisce quelli del **catalogo condiviso**, che hanno la scheda completa. Un nome che non c'è viene aggiunto al catalogo, visibile a tutti gli utenti, senza scheda: si lancia ugualmente, ma solo per spendere lo slot.

### Zaino

**Armatura indossata** e scudo, che determinano la CA (con gli avvisi per svantaggio in Furtività e Forza insufficiente). Monete (mr, ma, me, mo, mp), oggetti con quantità e peso, e barra del carico rispetto alla capacità di trasporto (FOR × 15 lb), armatura compresa.

### Progresso XP

Registro degli XP guadagnati, ognuno con un motivo e una data, e barra verso la soglia del livello successivo. Quando raggiungi la soglia compare **Sali di livello**: aggiunge i PF medi del Dado Vita della classe più COS e un Dado Vita, i privilegi del nuovo livello presenti nel catalogo e, al livello giusto, ti fa scegliere la sottoclasse. Ti ricorda anche cos'altro cambia: nuovi slot, incantesimi, trucchetti, aumenti di caratteristica.

### Tratti & Background

Tratti caratteriali, ideali, legami, difetti, biografia, dettagli fisici, **competenze e lingue** (lingue, strumenti, armi e armature, modificabili) e privilegi di razza, classe e background.

## Account e personaggi

All'apertura l'app chiede di accedere. Chi non ha un account può **registrarsi** dalla stessa schermata: lo username ha da 3 a 30 caratteri e la password almeno 8. L'accesso dura 30 giorni per ogni browser.

Per cambiare **username o password** clicca il tuo nome nell'intestazione: si apre la finestra *Account*. Entrambe le modifiche chiedono la password attuale. Dopo il cambio della password gli altri dispositivi devono accedere di nuovo, mentre quello che stai usando resta collegato.

Dopo l'accesso compare l'elenco dei **tuoi personaggi**: ogni utente vede solo i propri. Per aggiungerne uno puoi **crearlo** o importare una scheda esportata in JSON. L'app riapre da sola l'ultimo personaggio usato, e il pulsante **Personaggi** nell'intestazione riporta all'elenco.

Le password sono salvate nel database solo come hash (scrypt), e la sessione è un cookie che la pagina non può leggere. I tentativi con una password sbagliata vengono rallentati.

## Creare un personaggio

**Crea personaggio**, nell'elenco, apre una procedura guidata di sette passi. A destra un riepilogo mostra punteggi, PF e CA mentre scegli:

1. **Razza** e sottorazza (o antenato draconico), con le scelte che la razza prevede: le lingue, i +1 e le abilità del Mezzelfo, lo strumento del Nano, il trucchetto dell'Alto Elfo.
2. **Classe**, tra le 12 del manuale: abilità a scelta, strumenti del Bardo e del Monaco, sottoclasse per Chierico, Stregone e Warlock (le altre la scelgono salendo di livello).
3. **Caratteristiche**: sei tiri di 4d6 scartando il dado più basso, con i tuoi dadi o con quelli dell'app. Poi assegni i sei totali; i bonus di razza si aggiungono da soli.
4. **Background**: se un'abilità è già tua ne scegli un'altra, come prevede il manuale. Poi lingue e strumenti.
5. **Equipaggiamento**: le opzioni della classe (per esempio "ascia bipenne oppure un'arma da guerra da mischia") più gli oggetti e le monete del background. Armatura e scudo vengono indossati.
6. **Incantesimi**: trucchetti e incantesimi di 1° livello dal catalogo, nei numeri della classe.
7. **Dettagli**: nome, allineamento, aspetto, tratti, ideali, legami, difetti e storia.

Il personaggio nasce al 1° livello con i PF massimi del Dado Vita più COS, le competenze della classe, della razza e del background e i privilegi di 1° livello.

## Salvataggio

I dati stanno in un database **PostgreSQL**: in produzione su [Neon](https://neon.tech), in sviluppo in un container Docker. Ogni parte del personaggio ha la sua tabella (caratteristiche, slot, inventario, esperienza…). Incantesimi, armi, armature, privilegi, razze e background stanno in **cataloghi condivisi**, a cui i personaggi sono collegati: la descrizione di *Dardo Incantato* è scritta una volta sola e vale per tutti. I cataloghi ufficiali sono in [`packages/regole/src/semi/`](packages/regole/src/semi/): tutte le razze, i background, le armi, le armature e gli incantesimi del Manuale del Giocatore e i privilegi delle 12 classi con le sottoclassi, con descrizioni riassunte.

**Da più dispositivi.** Ogni dispositivo carica gli aggiornamenti degli altri quando torni sulla pagina, e comunque ogni 15 secondi. Se due dispositivi modificano la scheda nello stesso momento, l'app chiede quale versione tenere.

**Offline.** Ogni modifica finisce anche nel `localStorage` del browser. Se il server non è raggiungibile, l'indicatore nell'intestazione passa a *Offline* e le modifiche vengono inviate appena torna disponibile.

**Risveglio.** Sul piano gratuito il server si spegne dopo 15 minuti senza richieste: la prima apertura successiva può richiedere fino a un minuto, e l'app mostra *Avvio del server in corso…*. Mentre una scheda è aperta l'app contatta il server ogni 15 secondi, quindi durante una sessione di gioco resta acceso.

**Backup.** Dentro una scheda **Esporta JSON** scarica la scheda e **Importa JSON** la sostituisce (su tutti i dispositivi); dall'elenco dei personaggi l'import ne crea una nuova. L'import accetta anche il formato delle versioni precedenti dell'app. Neon conserva la storia del database per il ripristino a un momento passato (sul piano gratuito per un periodo breve).

## Cosa non gestisce (ancora)

- Multiclasse, catalogo dei talenti e loro effetti, scambio di un incantesimo conosciuto alla salita di livello.
- Suppliche Occulte e Manovre sono solo descritte; le risorse di classe contano gli usi ma non applicano l'effetto.
- Non si possono eliminare account e personaggi e non c'è il recupero della password dimenticata.
- Chiunque può aggiungere voci ai cataloghi condivisi (incantesimi, armi, privilegi), visibili a tutti gli utenti.

## Sviluppo

Servono **Node.js 24** e **Docker** (per PostgreSQL).

```bash
npm install
cp .env.example .env          # DATABASE_URL del Postgres di docker compose, PORT dell'API
docker compose up -d          # PostgreSQL 17 sulla porta 5440
npm run db:prepara            # migrazioni e cataloghi ufficiali
npm run dev                   # API (porta 3100) e app (http://localhost:5173), con ricaricamento automatico
```

L'app di Vite inoltra `/api` all'API Fastify, come fa Vercel in produzione. È raggiungibile anche dagli altri dispositivi della rete di casa: all'avvio Vite stampa l'indirizzo `Network`. Se la porta 5173 è occupata, Vite usa la successiva.

| Comando | Cosa fa |
|---|---|
| `npm run dev` | API e app con ricaricamento automatico |
| `npm test` | Test delle regole e dell'API su PostgreSQL (Vitest; serve `docker compose up -d`) |
| `npm run lint` | ESLint |
| `npm run build` | Controllo dei tipi, build dell'app (`apps/web/dist`) e bundle dell'API (`apps/api/dist`) |
| `npm run db:prepara` | Migrazioni e cataloghi ufficiali sul database di `DATABASE_URL` |
| `npm run migra -w @dnd/api` | Solo le migrazioni |
| `npm run semina -w @dnd/api` | Solo i cataloghi ufficiali (dopo aver modificato `packages/regole/src/semi/`) |

I test usano solo `DATABASE_URL_TEST` (predefinito: il Postgres di docker compose) e creano un database per ogni test a partire da un modello, poi lo eliminano. Non puntarlo mai al database di produzione.

**Cambiare lo schema.** Aggiungi un file in [`apps/api/migrazioni/`](apps/api/migrazioni/) con il numero successivo (`002_…sql`). Una migrazione si applica una volta sola e non si modifica più dopo il merge. Il deploy applica le migrazioni *prima* di aggiornare il server, quindi devono funzionare anche con la versione precedente del codice: aggiungi colonne (con un valore predefinito) e tabelle, e togli quelle che non servono più solo in un deploy successivo.

## Pubblicazione

```
Browser → Vercel (app statica) → Render (API, Docker) → Neon (PostgreSQL)
              ↑                      ↑                        ↑
       deploy automatico      deploy dal workflow       migrazioni dal workflow,
       al push su main        Deploy (deploy hook)      prima del codice
```

Tutto su piani gratuiti: Neon (circa 0,5 GB, si sospende da inattivo), Render (si spegne dopo 15 minuti, il risveglio richiede circa 30-60 s), Vercel Hobby (solo uso non commerciale). Il frontend inoltra `/api` a Render con le rewrite di [`apps/web/vercel.json`](apps/web/vercel.json): stessa origine per il browser, quindi niente CORS e il cookie di sessione resta `SameSite=Strict` e `Secure`. Le scelte sono motivate in [ADR-0002](docs/adr/0002-pubblicazione-su-piani-gratuiti.md).

**Prima configurazione**, una volta sola:

1. **Neon.** Crea il progetto nella regione *AWS Europe Central 1 (Frankfurt)*. Copia la stringa di connessione **diretta**, cioè senza `-pooler` nell'host.
2. **Database.** Da questo computer, con quella stringa al posto di quella locale:
   ```bash
   DATABASE_URL='postgresql://…' NODE_ENV=production npm run db:prepara
   ```
   Per portare utenti e personaggi dall'archivio SQLite della versione precedente, vedi *Import dall'archivio SQLite* qui sotto.
3. **Render.** *New → Blueprint* sul repository: legge [`render.yaml`](render.yaml). Imposta `DATABASE_URL` (la stringa di Neon) nella dashboard del servizio `dnd-api`. Poi copia da *Settings → Deploy Hook* il **Deploy Hook del servizio**: non il Sync Hook del Blueprint, che serve ad altro. Annota l'indirizzo del servizio (`https://dnd-api….onrender.com`).
4. **Vercel.** Se l'indirizzo di Render cambia (oggi è `https://dnd-api-6pmu.onrender.com`), correggilo in [`apps/web/vercel.json`](apps/web/vercel.json): le rewrite di `vercel.json` non leggono variabili d'ambiente, l'indirizzo va scritto per intero (non è un segreto). Poi *Add New → Project*, importa il repository e imposta la **Root Directory** `apps/web`. Il resto Vercel lo riconosce da solo (Vite, workspace npm).
5. **Secret di GitHub**, nell'environment `production` (lo crea il primo comando). Incolla i valori **al prompt**, non nella riga di comando: in zsh un URL con `?` dà `no matches found`, e così i valori non finiscono nella cronologia.
   ```bash
   gh secret set PRODUCTION_DATABASE_URL --env production
   gh secret set RENDER_DEPLOY_HOOK_URL --env production
   ```
6. **Protezione di `main`.** *Settings → Rules → Rulesets*: un ruleset su `main` con *Require a pull request* e *Require status checks* (`lint`, `typecheck`, `test`, `build`, `docker`). Lascia vuota la lista dei bypass: il ruleset vale anche per te.

**A ogni merge su `main`** la CI gira di nuovo. Se è verde, il workflow `Deploy` applica migrazioni e cataloghi su Neon e chiama il deploy hook di Render con il commit esatto. Vercel pubblica il frontend da solo.

**Import dall'archivio SQLite.** L'esportazione si fa con il codice della versione SQLite (commit `7226584`), poi si importa in un database vuoto, già migrato e seminato:

```bash
git worktree add ../dnd-esporta 7226584
(cd ../dnd-esporta && npm ci && node scripts/esportaSqlite.ts "$PWD/../DnD_Player/archivio/dnd_player.sqlite" "$PWD/../DnD_Player/archivio/esportazione.json")
git worktree remove ../dnd-esporta
DATABASE_URL='postgresql://…' NODE_ENV=production npm run importa -w @dnd/api -- "$PWD/archivio/esportazione.json"
```

Utenti, password, personaggi e revisioni restano gli stessi. Il file di esportazione contiene gli hash delle password: tienilo in `archivio/`, che è escluso da git, e cancellalo dopo l'import.

## Com'è fatto

Workspace npm con tre pacchetti, tutto in TypeScript. Le motivazioni sono in [ADR-0001](docs/adr/0001-postgres-fastify-workspace.md).

- [`packages/regole/`](packages/regole/) (`@dnd/regole`): codice puro condiviso da app e API. Contiene le regole come funzioni ([`regole.ts`](packages/regole/src/regole.ts), con i test in [`regole.test.ts`](packages/regole/src/regole.test.ts)), le 12 classi ([`dati/classi.ts`](packages/regole/src/dati/classi.ts)), la creazione del personaggio ([`creazione.ts`](packages/regole/src/creazione.ts)), la validazione della scheda ([`scheda.ts`](packages/regole/src/scheda.ts)), i tipi dell'API ([`api.ts`](packages/regole/src/api.ts)) e i cataloghi ufficiali ([`semi/`](packages/regole/src/semi/)).
- [`apps/web/`](apps/web/) (`@dnd/web`): l'app, con React 19, Vite e Tailwind CSS v4 e icone di [lucide-react](https://lucide.dev). Una tab per sezione in [`components/`](apps/web/src/components/), più la copia locale e la sincronizzazione ([`salvataggio.ts`](apps/web/src/salvataggio.ts), [`sincronizzazione.ts`](apps/web/src/sincronizzazione.ts)) e le chiamate all'API ([`accesso.ts`](apps/web/src/accesso.ts)).
- [`apps/api/`](apps/api/) (`@dnd/api`): l'API Fastify. Contiene le rotte ([`src/rotte/`](apps/api/src/rotte/)), la conversione tra scheda e tabelle ([`personaggi.ts`](apps/api/src/personaggi.ts)), i cataloghi ([`catalogo.ts`](apps/api/src/catalogo.ts)), utenti e sessioni ([`accesso.ts`](apps/api/src/accesso.ts)), le migrazioni ([`migrazioni/`](apps/api/migrazioni/)) e i test su PostgreSQL ([`test/`](apps/api/test/)).

La scheda contiene solo i dati di base del personaggio. Tutto ciò che si può calcolare, come modificatori, TS, CA e slot massimi, viene ricalcolato a ogni modifica, così i valori restano sempre coerenti. Le convenzioni per chi sviluppa sono in [`CLAUDE.md`](CLAUDE.md).
