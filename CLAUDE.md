# CLAUDE.md — DnD_Player

Scheda personaggio interattiva per D&D 5e (**edizione 2014**). Workspace npm in TypeScript (strict): `packages/regole` (`@dnd/regole`: regole, tipi, validazione e cataloghi ufficiali, codice puro condiviso), `apps/web` (React 19, Vite 8, Tailwind CSS v4) e `apps/api` (Fastify 5 su PostgreSQL 17 con `node-postgres`, senza ORM). In produzione (dal 7 ottobre 2026): app su Vercel (https://dnd-player-two.vercel.app, Root Directory `apps/web`), API su Render (servizio `dnd-api`, https://dnd-api-6pmu.onrender.com, Docker, branch `main`), database su Neon (Frankfurt). Vedi `docs/adr/` e la sezione "Pubblicazione" del README. I test (Vitest) coprono regole, archivio e rotte. Repository git: si sviluppa sul branch `sviluppo`; `main` è il ramo pubblicato, protetto dal ruleset "Protezione di main" (PR obbligatoria, controlli `lint`, `typecheck`, `test`, `build`, `docker` verdi, niente push diretto né force push, nessun bypass). Il merge su `main` pubblica: il workflow `Deploy` applica migrazioni e cataloghi su Neon e poi chiama il deploy hook di Render; Vercel si aggiorna da solo. Per pubblicare: push su `sviluppo`, PR `sviluppo → main`, merge a CI verde.

**Obiettivo: una piattaforma che possa usare chiunque**, con registrazione pubblica e più personaggi per utente. Le regole coprono le 12 classi del Manuale del Giocatore e c'è una procedura guidata per creare personaggi dal 1° al 20° livello; il personaggio di riferimento è Alston il Breve (Gnomo delle Rocce, Mago della Scuola di Divinazione). Scrivi le nuove funzioni in modo generico, non cablate su Alston o sul Mago.

## Comandi

```bash
docker compose up -d   # PostgreSQL 17 sulla porta 5440 (serve a dev e test)
npm run db:prepara     # migrazioni + cataloghi ufficiali sul database di DATABASE_URL (.env, vedi .env.example)
npm run dev            # API Fastify (porta 3100, tsx watch) + Vite (http://localhost:5173, proxy di /api, aperto alla LAN)
npm run build          # tsc -b (type check di tutto) + vite build (apps/web/dist) + bundle esbuild dell'API (apps/api/dist)
npm run lint           # ESLint (typescript-eslint; react-hooks e react-refresh solo per apps/web)
npm test               # Vitest: progetto "regole" (puro) e "api" (su PostgreSQL, DATABASE_URL_TEST)
npm run migra -w @dnd/api / npm run semina -w @dnd/api / npm run importa -w @dnd/api -- <file>
```

Prima di dichiarare finito un lavoro, esegui `npm test`, `npm run lint` e `npm run build`: devono passare tutti senza errori (i test dell'API vogliono `docker compose up -d`). Ogni nuova regola in `regole.ts` va accompagnata da un test in `packages/regole/src/regole.test.ts`.

## Architettura

Il codice è in `packages/regole/src` (regole pure, tipi, dati delle classi in `dati/`, seed dei cataloghi in `semi/`), `apps/api/src` (rotte in `rotte/`, migrazioni SQL in `apps/api/migrazioni/`) e `apps/web/src` (una tab per file in `components/Tab*.tsx`). Note che il codice non dice:

- `packages/regole/src/dati/competenze.ts` non importa da `regole.ts`: la usa anche `condizioni.ts`.
- I test di `creazione.ts` (pacchetto condiviso) stanno in `apps/api/test/creazione.test.ts`, perché usano il catalogo del database; `apps/api/test/catalogo.test.ts` controlla scuola, classi e dadi di ogni incantesimo.
- I seed di `packages/regole/src/semi/` hanno descrizioni riassunte, non il testo del manuale, e stanno nel pacchetto condiviso perché li usano anche i test delle regole.
- `apps/api/src/importa.ts` (import dell'archivio SQLite) è già stato eseguito su Neon; l'esportazione si fa dal commit `7226584` (README).
- `sessioneAttuale` (`apps/web/src/accesso.ts`) riprova fino a 90 s durante il risveglio del server su Render.

- **Dati grezzi e valori derivati.** `CharacterData` contiene solo dati grezzi. Tutto ciò che si calcola (modificatori, TS, abilità, CA, iniziativa, CD e attacco magico, bonus competenza, slot massimi, limite di preparazione, soglia XP, attacco e danno delle armi) viene da `derivate(char)`, calcolata a ogni render in `App` e passata alle tab come `d`. **Non memorizzare nello stato un valore derivabile e non scriverlo a mano nel JSX:** aggiungilo a `derivate()`.
- **Stato.** Un solo `useState<CharacterData>` in `App`, aggiornato in modo immutabile con `setChar(prev => ...)`. Le tab ricevono `char`, `d` e `setChar`. Lo stato solo di interfaccia (input dei form, ultimo tiro) resta locale nella tab.
- **Risorse, condizioni ed effetti.** In `CharacterData` ci sono solo dati grezzi: `risorseUsate` (usi spesi per id), `condizioni` (id), `indebolimento` (0–6), `effetti` (`{ id, valore? }`) e `note`. Massimi, ricariche, CA e vantaggio/svantaggio si derivano dalle definizioni in `packages/regole/src/dati/`. Gli effetti di un incantesimo si attivano da soli al lancio (`effettoDaIncantesimo`, per nome). I d20 passano da `conSuggerimento()` (`apps/web/src/tiroDadi.ts`) per preselezionare vantaggio o svantaggio; non ricalcolarli a mano. Per aggiungere una risorsa o un effetto basta una voce in `RISORSE` / `EFFETTI` e un test.
- **Tiri di dado.** Ogni tiro passa da `chiediTiro()` o, per i d20, da `chiediD20()` (`apps/web/src/tiroDadi.ts`); per i danni c'è `tiraDanni()`. Tutti aprono `components/DialogoTiro.tsx`. L'utente sceglie se inserire i risultati dei propri dadi fisici o se far tirare l'app. È una richiesta esplicita dell'utente: **non chiamare mai `tiraD` direttamente in una funzionalità**. `chiediTiro` restituisce una Promise con i risultati (`null` se l'utente annulla), quindi gli handler sono `async`. Il tiro avviene **fuori** dall'updater di `setChar`, perché in StrictMode React chiama l'updater due volte, e gli esiti vengono passati alle funzioni pure (vedi `riposoLungo(c, presagio)`). `App` crea `chiediTiro` e `chiediD20` con `useRichiestaTiro()` e li passa alle tab che ne hanno bisogno.
- **Slot.** `slotSpesi` è un array di 9 elementi (indice 0 = slot di 1° livello). I massimi vengono da `slotMassimi(incantatore, livello)`; per il patto del Warlock solo il livello degli slot ha un valore (gli altri sono 0 e non si mostrano).
- **Classi.** Le regole stanno nel codice (`packages/regole/src/dati/classi.ts`), perché servono a `derivate()` anche offline; i testi dei privilegi stanno nel catalogo. `incantatoreDi(classe, sottoclasse)` restituisce anche i terzi incantatori. Privilegi che cambiano i calcoli si riconoscono per nome (`Robustezza Nanica`, `Resilienza Draconica`, `Astuzia Gnomesca`).

## Archivio (PostgreSQL)

- **Tutti i dati del personaggio sono in tabelle**, non in un JSON: `personaggi` (colonne per info, PF, monete, lore, `avatar`…) più le tabelle figlie `personaggio_caratteristiche`, `_abilita`, `_slot`, `_presagio`, `_xp`, `_oggetti` (l'inventario è proprio del personaggio; `consumabile` e `consumo_giornaliero` per le provviste), `_risorse`, `_condizioni`, `_effetti`, `_difese` (resistenze, immunità e vulnerabilità scritte a mano), `_note`, `_note_campi` (`indebolimento` è una colonna di `personaggi`). Nomi `citext` (senza distinzione di maiuscole), flag `boolean`, date `timestamptz`, ordine delle liste in colonne `ordine`.
- **Cataloghi per la creazione**: `razze` (con `razza_madre_id` per le sottorazze, `razza_competenze`, `razza_privilegi`), `background` (`background_competenze`, `background_oggetti`), `armature`, `classe_privilegi(classe, sottoclasse, livello)`, `incantesimo_classi`. Il personaggio ha `taglia`, `armatura_id`, `scudo` e `personaggio_competenze(tipo: lingua/strumento/arma/armatura)`.
- **Cataloghi condivisi** `incantesimi`, `armi`, `privilegi`, collegati con le tabelle ponte `personaggio_incantesimi` (con `preparato`), `personaggio_armi` (chiave `personaggio_id, ordine`: una riga per copia, con `bonus`, munizioni, durabilità e `rotta`), `personaggio_privilegi`. Ogni voce ha `creato_da`: NULL = ufficiale (seed), altrimenti l'utente che l'ha aggiunta. Per ora chiunque può aggiungere voci (sono condivise con tutti); in produzione si userà solo il catalogo ufficiale.
- **L'API resta "a documento"**: il client legge e scrive `CharacterData` intero. Su `PUT` il server completa i campi assenti con quelli salvati (`completaConEsistente`: un client con una versione vecchia dell'app non deve cancellare i campi che non conosce), lo valida con `daJSON()` e lo scompone (`scomponi`, dentro la transazione della revisione); su `GET` lo ricompone (`componi`). Il client non conosce le tabelle.
- **Le voci di catalogo si risolvono per nome** (privilegi: nome + fonte, senza distinguere maiuscole; un privilegio che migliora con il livello ha una sola voce, con le soglie nella descrizione), mai per id: così funzionano l'import dei vecchi JSON e le voci nuove. Un nome sconosciuto crea una voce con `creato_da`. I campi di una voce esistente vengono sempre dal catalogo: una `PUT` non può modificarla. `concentrazione` resta il nome nel JSON (`concentrazione_id` nell'archivio).
- **Seed**: per correggere o aggiungere voci ufficiali modifica `packages/regole/src/semi/`. `aggiornaCataloghi` (`npm run semina`) fa l'upsert, ma solo sulle voci con `creato_da IS NULL`. **Non gira all'avvio del server**: la esegue il workflow Deploy dopo le migrazioni (in locale `npm run db:prepara`).
- **Cambiare lo schema**: aggiungi `apps/api/migrazioni/NNN_descrizione.sql` con il numero successivo; non modificare mai una migrazione già su `main`. Il deploy applica le migrazioni **prima** di aggiornare il server, quindi devono funzionare anche con il codice precedente: aggiungi colonne (con `DEFAULT`) e tabelle; rinomina o togli solo in due deploy. I dati degli utenti non devono andare persi. Se aggiungi un campo a `CharacterData`, aggiorna `personaggioVuoto()`, `normalizza()`, `scomponi` e `componi` (e `SQL_SCHEDA`), e il test di andata e ritorno in `apps/api/test/personaggi.test.ts`.
- **Prestazioni**: in produzione ogni query attraversa la rete (Render ↔ Neon). Niente query in un ciclo: usa `inserisciRighe`, `ANY($1::tipo[])`, `unnest` e `json_agg`, come in `scomponi`, `componi` e `idVoci`.
- **Test**: usano solo `DATABASE_URL_TEST` (mai `DATABASE_URL`). Per un test che tocca il database usa `await archivioDiProva()`.
- **Produzione**: la stringa di Neon e il deploy hook di Render sono segreti (environment `production` di GitHub, dashboard di Render): non chiederli in chat e non scriverli in file versionati. Per un comando contro Neon l'utente li incolla al prompt (`read -rs "DATABASE_URL?…"`). La copia locale (Docker) e quella online sono separate.

## Accesso

- Registrazione pubblica (`POST /api/registrazione`): username 3–30 caratteri `a-z 0-9 . _ -` (senza distinzione di maiuscole), password di almeno 8 caratteri.
- **Modifica dell'account** (`FinestraAccount`, aperta dal pulsante con lo username nell'intestazione): `PUT /api/account/username` e `PUT /api/account/password` chiedono sempre la password attuale e applicano le stesse regole della registrazione. Una password attuale sbagliata risponde **403** (non 401, che per il client vuol dire sessione scaduta) dopo 1 s. Il cambio di password chiude le sessioni degli altri dispositivi e lascia aperta quella in uso; il cambio di username non tocca le sessioni.
- Senza una sessione valida l'API risponde 401 a tutto tranne registrazione e accesso. Un personaggio di un altro utente risponde 404, come se non esistesse.
- Le password sono hash `scrypt$sale$hash`. Delle sessioni si salva solo lo SHA-256 del token; il token sta nel cookie `dnd_sessione` (HttpOnly, SameSite=Strict, `Secure` in produzione, 30 giorni). Un accesso fallito risponde dopo 1 s. **Non scrivere password in chiaro nel codice, nei test o nella documentazione.**
- Limiti ai tentativi (`@fastify/rate-limit`, risposta 429 con `{ errore }`): accesso 10 ogni 5 minuti per username, registrazione 10 l'ora per IP, modifiche dell'account 10 ogni 5 minuti per sessione. `trustProxy` è attivo (Vercel e Render davanti).
- Un archivio nuovo non ha utenti.
- Se il server risponde 401 durante l'uso, `useSincronizzazione` chiama `onSessioneScaduta` e `App` torna al login; con 404 chiama `onInesistente` e `App` torna all'elenco. Le modifiche non inviate restano in `localStorage`.

## Salvataggio e sincronizzazione

- Il `localStorage` (`dnd_personaggio_<id>` e `dnd_personaggio_<id>_sincronizzazione`) è una copia offline: la scheda si mostra subito da lì, poi arriva quella del server. Prima di aprire un personaggio senza copia locale, `App` lo scarica.
- Ogni modifica va subito nel `localStorage` e dopo 500 ms al server con `PUT { dati, revisione }`. Il server accetta solo se la revisione coincide, altrimenti risponde 409 con la versione attuale e il client chiede con `confirm()` quale tenere. Gli aggiornamenti degli altri dispositivi si scaricano all'avvio, al focus o al ritorno sulla pagina, e ogni 15 s.
- Import JSON: dalla schermata dei personaggi crea un personaggio nuovo (`POST /api/personaggi`); dentro la scheda sostituisce quella aperta. Non c'è più "Ripristina ai dati iniziali".
- In sviluppo `server.host` è `true`: l'app è raggiungibile dalla rete locale su http. In produzione tutto passa da https (Vercel e Render). Se l'indirizzo di Render cambia va corretto in `apps/web/vercel.json` (le rewrite non leggono variabili d'ambiente).
- Render gratis si spegne dopo 15 minuti: all'avvio `sessioneAttuale` riprova sugli errori 502/503/504 e `App` mostra "Avvio del server in corso…". La sincronizzazione ogni 15 s tiene il server acceso durante il gioco.
- `daJSON()` (`packages/regole/src/scheda.ts`) valida i dati e li normalizza, completando le sezioni mancanti con `personaggioVuoto()`. Converte anche il vecchio formato senza `versione` (`migraV1`) e la versione 2, con i pesi in libbre (`daLibbreAKg`, 1 lb = 0,5 kg: copie locali e JSON esportati diventano kg una volta sola). `versione` è 3. Il server rifiuta con 400 ("ricarica la pagina") le `POST`/`PUT` con una `versione` diversa: arrivano solo da una pagina aperta prima dell'aggiornamento. Se un cambiamento a `CharacterData` non è compatibile, porta `versione` a 4, converti in `daJSON` e aggiungi una migrazione (il modello è `003_pesi_in_kg.sql`).

## Attenzione

- **`apps/web/src/index.css` deve restare minimale.** Tailwind v4 mette le utility in `@layer` e qualunque CSS fuori dai layer vince su di esse. Il vecchio CSS del template rendeva il nome del personaggio illeggibile. Gli stili vanno scritti come classi Tailwind nel JSX.
- Tailwind v4 si configura tramite il plugin `@tailwindcss/vite`: non ci sono `tailwind.config.js` né `postcss.config.js`.
- `react-refresh/only-export-components`: i file in `apps/web/src/components/` devono esportare solo componenti. Costanti e funzioni condivise vanno in `regole.ts`.
- `packages/regole` gira nel browser e in Node: niente DOM, niente API di Node e niente React (il suo `tsconfig.src.json` non ha né `DOM` né `@types/node`). Si importa con il percorso del file: `@dnd/regole/regole.ts`, `@dnd/regole/dati/classi.ts`. I pacchetti espongono i sorgenti `.ts` (risoluzione `bundler`): niente build del pacchetto condiviso.
- Le porte 3000, 5173 e 5432 sono spesso occupate da altri progetti in Docker: l'API di sviluppo usa la 3100 e Postgres la 5440; Vite passa da solo alla prima porta libera.
- Tipi da React: usa `import { type FormEvent } from "react"`, non `React.FormEvent` (con `verbatimModuleSyntax` il namespace globale non è disponibile).

## Convenzioni

- **Tutto in italiano**: identificatori (`pfAttuali`, `saliDiLivello`, `aggiungiOggetto`), testi della UI e commenti. Mantieni questa convenzione.
- Terminologia ufficiale italiana di D&D 5e. Attenzione: **Invocazione = Evocation** e **Evocazione = Conjuration**. Sigle: FOR, DES, COS, INT, SAG, CAR; monete mr/ma/me/mo/mp.
- Unità di misura: velocità, altezza e peso del personaggio in metrico; pesi dell'inventario, delle armature e capacità di carico in kg (1 lb = 0,5 kg, come nel Manuale in italiano: capacità FOR × 7,5 kg, scudo 3 kg, armatura di piastre 32,5 kg). I pesi dei seed e delle dotazioni sono già in kg.
- Stile: tema scuro `slate-950`/`slate-900`, accento `indigo`, card con `rounded-xl border border-slate-800`, icone da `lucide-react`. Per le azioni distruttive chiedi conferma con `confirm()`.

## Regole implementate (5e 2014)

Il riepilogo delle regole già implementate, delle regole della casa e di ciò che manca è nella skill `regole-implementate` (`.claude/skills/regole-implementate/SKILL.md`): leggila prima di modificare o aggiungere una regola, e aggiornala quando cambi il comportamento di una regola.
