# CLAUDE.md — DnD_Player

Scheda personaggio interattiva per D&D 5e (**edizione 2014**), React 19, TypeScript (strict), Vite 8, Tailwind CSS v4. Il "backend" è un plugin di Vite che espone un archivio SQLite (`node:sqlite`, serve Node 22.13+) su `/api` (registrazione, accesso, personaggi, catalogo): nessun server separato e nessuna dipendenza in più. I test (Vitest) coprono regole e archivio. Repository git: `main` è il ramo stabile e si sviluppa sul branch `sviluppo`.

**Obiettivo: una piattaforma che possa usare chiunque**, con registrazione pubblica e più personaggi per utente. Oggi l'unico personaggio completo è Alston il Breve (Gnomo delle Rocce, Mago della Scuola di Divinazione) e le regole implementate sono quelle del Mago. Scrivi le nuove funzioni in modo generico, non cablate su Alston.

## Comandi

```bash
npm run dev      # dev server Vite + API SQLite (http://localhost:5173, aperto anche alla LAN)
npm run build    # tsc -b (type check) + vite build → dist/
npm run lint     # ESLint (typescript-eslint + react-hooks + react-refresh)
npm test         # Vitest (src/**/*.test.ts e server/**/*.test.ts)
npm run preview  # serve la build di produzione, con la stessa API
```

Prima di dichiarare finito un lavoro, esegui `npm test`, `npm run lint` e `npm run build`: devono passare tutti senza errori. Ogni nuova regola in `regole.ts` va accompagnata da un test in `src/regole.test.ts`.

## Architettura

| File | Contenuto |
|---|---|
| `src/tipi.ts` | Tipi: `CharacterData` (versione 2), `Spell` (con `scheda?: DettagliIncantesimo` dal catalogo), `SchedaIncantesimo`, `Arma`, `Privilegio`, `SetChar`… |
| `src/regole.ts` | Regole pure: tabelle di XP, slot del Mago, abilità e scuole; `derivate()`, riposi, livelli, danni (`Danni`, `critico`, `dannoArma`, `dannoIncantesimo`), lancio (`lanciaIncantesimo`), PF (`applicaDanno`, `applicaCura`, `esitoTsMorte`, `statoVita`), `risultatoD20`, `tiraD()` |
| `src/regole.test.ts` | Test Vitest delle regole e della migrazione dei salvataggi |
| `src/scheda.ts` | `daJSON()` (validazione e normalizzazione, anche dei vecchi formati) e `personaggioVuoto()`. Senza DOM: la usa anche il server |
| `src/dati/alston.ts` | `INITIAL_CHARACTER`: la scheda di Alston, usata come esempio e nei test (non è più un valore predefinito) |
| `src/tiroDadi.ts` | `useRichiestaTiro()` → `chiediTiro`, `chiediD20` (normale / vantaggio / svantaggio), `tiraDanni` |
| `src/accesso.ts` | Chiamate all'API: `sessioneAttuale()`, `accedi()`, `registra()`, `esci()`, `cambiaUsername()`, `cambiaPassword()`, `elencoPersonaggi()`, `importaPersonaggio()`, `catalogoIncantesimi()`; tipi `Utente`, `RiassuntoPersonaggio`, `VoceIncantesimo` |
| `src/salvataggio.ts` | Copia locale per id del personaggio (`carica`, `salva`, `ultimoPersonaggio`), `scaricaDalServer` / `inviaAlServer` su `/api/personaggi/:id` |
| `src/sincronizzazione.ts` | `useSincronizzazione(personaggio, char, setChar, { onSessioneScaduta, onInesistente })`: allinea la scheda con l'archivio e restituisce lo stato mostrato nell'intestazione |
| `server/schema.ts` | Schema SQLite (`PRAGMA user_version` = 2), migrazione dalla versione 1 (JSON unico) con copia `.bak-v1` |
| `server/personaggi.ts` | `scomponi` (scheda → tabelle) e `componi` (tabelle + cataloghi → scheda), `creaPersonaggio`, `elencoPersonaggi`, `diUtente` |
| `server/catalogo.ts` | Cataloghi condivisi: `aggiornaCataloghi` (upsert dei seed), `idIncantesimo` / `idArma` / `idPrivilegio` (cerca per nome o crea), `elencoIncantesimi` |
| `server/semi/` | Seed dei cataloghi ufficiali: `incantesimi.ts` (`SCHEDE_INCANTESIMI`), `armi.ts`, `privilegi.ts` |
| `server/archivio.ts` | `apriArchivio`, `leggi` e `scrivi` con revisione e controllo del proprietario |
| `server/accesso.ts` | Utenti e sessioni: `creaUtente`, `erroreUsername` / `errorePassword` / `erroreRegistrazione`, `verificaCredenziali`, `passwordDiUtente`, `cambiaUsername`, `cambiaPassword`, `apriSessione`, `leggiSessione`, `chiudiSessione` |
| `server/api.ts` | Plugin Vite `apiPersonaggio()` su `/api` in dev e in preview (elenco delle rotte in testa al file). File `archivio/dnd_player.sqlite` (in `.gitignore`), oppure quello indicato da `DND_ARCHIVIO` |
| `server/*.test.ts` | Test di archivio, personaggi (scomporre/ricomporre), schema e migrazione, accesso |
| `src/App.tsx` | `App`: accesso → `SchermataPersonaggi` → `Scheda` (intestazione con PF, riposi, import/export, "Personaggi", uscita, e tab). L'ultimo personaggio aperto si riapre da solo |
| `src/components/Tab*.tsx` | Una tab ciascuno: Statistiche, Grimorio, Zaino, Progresso, Lore |
| `src/components/` (altri) | `SchermataAccesso` (accesso e registrazione), `SchermataPersonaggi` (scelta e import), `FinestraAccount` (cambio di username e password), `DialogoTiro`, `FinestraIncantesimo` (scheda da `spell.scheda` e lancio), `PannelloRiposoBreve`, `TiriMorte` |

- **Dati grezzi e valori derivati.** `CharacterData` contiene solo dati grezzi. Tutto ciò che si calcola (modificatori, TS, abilità, CA, iniziativa, CD e attacco magico, bonus competenza, slot massimi, limite di preparazione, soglia XP, attacco e danno delle armi) viene da `derivate(char)`, calcolata a ogni render in `App` e passata alle tab come `d`. **Non memorizzare nello stato un valore derivabile e non scriverlo a mano nel JSX:** aggiungilo a `derivate()`.
- **Stato.** Un solo `useState<CharacterData>` in `App`, aggiornato in modo immutabile con `setChar(prev => ...)`. Le tab ricevono `char`, `d` e `setChar`. Lo stato solo di interfaccia (input dei form, ultimo tiro) resta locale nella tab.
- **Tiri di dado.** Ogni tiro passa da `chiediTiro()` o, per i d20, da `chiediD20()` (`src/tiroDadi.ts`); per i danni c'è `tiraDanni()`. Tutti aprono `components/DialogoTiro.tsx`. L'utente sceglie se inserire i risultati dei propri dadi fisici o se far tirare l'app. È una richiesta esplicita dell'utente: **non chiamare mai `tiraD` direttamente in una funzionalità**. `chiediTiro` restituisce una Promise con i risultati (`null` se l'utente annulla), quindi gli handler sono `async`. Il tiro avviene **fuori** dall'updater di `setChar`, perché in StrictMode React chiama l'updater due volte, e gli esiti vengono passati alle funzioni pure (vedi `riposoLungo(c, presagio)`). `App` crea `chiediTiro` e `chiediD20` con `useRichiestaTiro()` e li passa alle tab che ne hanno bisogno.
- **Slot.** `slotSpesi` è un array di 9 elementi (indice 0 = slot di 1° livello). I massimi vengono da `SLOT_MAGO[livello - 1]`.

## Archivio (SQLite)

- **Tutti i dati del personaggio sono in tabelle**, non in un JSON: `personaggi` (colonne per info, PF, monete, lore…) più le tabelle figlie `personaggio_caratteristiche`, `_abilita`, `_slot`, `_presagio`, `_xp`, `_oggetti` (l'inventario è proprio del personaggio).
- **Cataloghi condivisi** `incantesimi`, `armi`, `privilegi`, collegati con le tabelle ponte `personaggio_incantesimi` (con `preparato`), `personaggio_armi`, `personaggio_privilegi`. Ogni voce ha `creato_da`: NULL = ufficiale (seed), altrimenti l'utente che l'ha aggiunta. Per ora chiunque può aggiungere voci (sono condivise con tutti); in produzione si userà solo il catalogo ufficiale.
- **L'API resta "a documento"**: il client legge e scrive `CharacterData` intero. Su `PUT` il server lo valida con `daJSON()` e lo scompone (`scomponi`, dentro la transazione della revisione); su `GET` lo ricompone (`componi`). Il client non conosce le tabelle.
- **Le voci di catalogo si risolvono per nome** (privilegi: nome + fonte, senza distinguere maiuscole), mai per id: così funzionano l'import dei vecchi JSON e le voci nuove. Un nome sconosciuto crea una voce con `creato_da`. I campi di una voce esistente vengono sempre dal catalogo: una `PUT` non può modificarla. `concentrazione` resta il nome nel JSON (`concentrazione_id` nell'archivio).
- **Seed**: per correggere o aggiungere voci ufficiali modifica `server/semi/`. A ogni avvio `aggiornaCataloghi` fa l'upsert, ma solo sulle voci con `creato_da IS NULL`.
- **Cambiare lo schema**: porta `VERSIONE_SCHEMA` al valore successivo e aggiungi una migrazione in `preparaSchema` (con copia di sicurezza del file). I dati degli utenti non devono andare persi. Se aggiungi un campo a `CharacterData`, aggiorna `personaggioVuoto()`, `normalizza()`, `scomponi` e `componi`, e il test di andata e ritorno in `server/personaggi.test.ts`.

## Accesso

- Registrazione pubblica (`POST /api/registrazione`): username 3–30 caratteri `a-z 0-9 . _ -` (senza distinzione di maiuscole), password di almeno 8 caratteri.
- **Modifica dell'account** (`FinestraAccount`, aperta dal pulsante con lo username nell'intestazione): `PUT /api/account/username` e `PUT /api/account/password` chiedono sempre la password attuale e applicano le stesse regole della registrazione. Una password attuale sbagliata risponde **403** (non 401, che per il client vuol dire sessione scaduta) dopo 1 s. Il cambio di password chiude le sessioni degli altri dispositivi e lascia aperta quella in uso; il cambio di username non tocca le sessioni.
- Senza una sessione valida l'API risponde 401 a tutto tranne registrazione e accesso. Un personaggio di un altro utente risponde 404, come se non esistesse.
- Le password sono hash `scrypt$sale$hash`. Delle sessioni si salva solo lo SHA-256 del token; il token sta nel cookie `dnd_sessione` (HttpOnly, SameSite=Strict, 30 giorni). Un accesso fallito risponde dopo 1 s. **Non scrivere password in chiaro nel codice, nei test o nella documentazione.**
- Un archivio nuovo non ha utenti. L'utente `alan` esiste solo perché migrato dalla versione 1 (`UTENTE_V1` in `schema.ts` serve solo alla migrazione).
- Se il server risponde 401 durante l'uso, `useSincronizzazione` chiama `onSessioneScaduta` e `App` torna al login; con 404 chiama `onInesistente` e `App` torna all'elenco. Le modifiche non inviate restano in `localStorage`.

## Salvataggio e sincronizzazione

- Il `localStorage` (`dnd_personaggio_<id>` e `dnd_personaggio_<id>_sincronizzazione`) è una copia offline: la scheda si mostra subito da lì, poi arriva quella del server. Prima di aprire un personaggio senza copia locale, `App` lo scarica.
- Ogni modifica va subito nel `localStorage` e dopo 500 ms al server con `PUT { dati, revisione }`. Il server accetta solo se la revisione coincide, altrimenti risponde 409 con la versione attuale e il client chiede con `confirm()` quale tenere. Gli aggiornamenti degli altri dispositivi si scaricano all'avvio, al focus o al ritorno sulla pagina, e ogni 15 s.
- Import JSON: dalla schermata dei personaggi crea un personaggio nuovo (`POST /api/personaggi`); dentro la scheda sostituisce quella aperta. Non c'è più "Ripristina ai dati iniziali".
- `server.host` e `preview.host` sono `true`: l'app è raggiungibile da tutta la rete locale, protetta dal login ma su http non cifrato. Va bene per la rete di casa, non per esporla su internet.
- `daJSON()` (`src/scheda.ts`) valida i dati e li normalizza, completando le sezioni mancanti con `personaggioVuoto()`. Converte anche il vecchio formato senza `versione` (`migraV1`). Se il cambiamento a `CharacterData` non è compatibile, porta `versione` a 3 e aggiungi una migrazione.

## Attenzione

- **`src/index.css` deve restare minimale.** Tailwind v4 mette le utility in `@layer` e qualunque CSS fuori dai layer vince su di esse. Il vecchio CSS del template rendeva il nome del personaggio illeggibile. Gli stili vanno scritti come classi Tailwind nel JSX.
- Tailwind v4 si configura tramite il plugin `@tailwindcss/vite`: non ci sono `tailwind.config.js` né `postcss.config.js`.
- `react-refresh/only-export-components`: i file in `components/` devono esportare solo componenti. Costanti e funzioni condivise vanno in `regole.ts`.
- Il codice in `server/` importa da `src/` (`tipi`, `regole`, `scheda`): quei file non devono usare il DOM. `tsconfig.node.json` usa la risoluzione `bundler`, perché server e config li carica Vite.
- Tipi da React: usa `import { type FormEvent } from "react"`, non `React.FormEvent` (con `verbatimModuleSyntax` il namespace globale non è disponibile).

## Convenzioni

- **Tutto in italiano**: identificatori (`pfAttuali`, `saliDiLivello`, `aggiungiOggetto`), testi della UI e commenti. Mantieni questa convenzione.
- Terminologia ufficiale italiana di D&D 5e. Attenzione: **Invocazione = Evocation** e **Evocazione = Conjuration**. Sigle: FOR, DES, COS, INT, SAG, CAR; monete mr/ma/me/mo/mp.
- Unità di misura: velocità, altezza e peso del personaggio in metrico; pesi dell'inventario e capacità di carico in libbre (lb).
- Stile: tema scuro `slate-950`/`slate-900`, accento `indigo`, card con `rounded-xl border border-slate-800`, icone da `lucide-react`. Per le azioni distruttive chiedi conferma con `confirm()`.

## Regole implementate (5e 2014)

- Mago: d6 per Dado Vita (4 + COS per livello dopo il 1°), TS in INT e SAG, slot dalla tabella ufficiale, incantesimi preparati = livello + mod INT, trucchetti 3/4/5.
- Competenze di Alston: Arcano e Storia (Sapiente), Religione e Intuizione (Mago).
- Riposo lungo: PF al massimo, recupero di metà dei Dadi Vita (minimo 1), slot ripristinati, nuovo Presagio, Recupero Arcano di nuovo disponibile.
- Riposo breve: un unico pannello (`components/PannelloRiposoBreve.tsx`), aperto dal pulsante nell'intestazione. Contiene la durata in ore (minimo 1), i Dadi Vita (d6 + COS ciascuno, tirabili a più riprese), il Canto di Riposo di un bardo del gruppo (solo se si spende almeno un Dado Vita), il recupero di 1 PF dopo 1d4 ore se si è stabilizzati a 0 PF, e il Recupero Arcano (slot per ⌈livello/2⌉ livelli complessivi, massimo il 5° livello, una volta al giorno). Nulla viene applicato finché non si preme "Completa riposo": allora `riposoBreve()` applica l'esito. Il Recupero Arcano si usa solo da qui; la tab Grimorio ne mostra solo lo stato.
- Divinazione: Presagio con 2d20, che diventano 3d20 dal 14° livello.
- PF: il danno consuma prima i PF temporanei. Cambiare la COS modifica retroattivamente i PF massimi.
- Tiri d20: normale, vantaggio o svantaggio. I TS di INT, SAG e CAR ricordano l'Astuzia Gnomesca.
- Danni: dopo un tiro per colpire con un'arma si tirano i danni (una o due mani per le armi versatili). Su un 20 naturale si raddoppiano i dadi, non il modificatore. Il totale non scende sotto 0.
- Incantesimi: cliccando il nome nel grimorio si apre `FinestraIncantesimo`. Si lancia con uno slot di livello pari o superiore (solo se preparato), come rituale senza slot, oppure come trucchetto. Lo slot viene speso e si tirano attacchi e danni, con il danno che scala per slot o per livello del personaggio. Un 1 naturale non fa danni. Un incantesimo aggiunto senza scheda nel catalogo si può lanciare ugualmente, ma solo per spendere lo slot.
- Concentrazione: lanciare un incantesimo con `concentrazione` la imposta (con conferma se ne interrompe un'altra). Ogni danno richiede un TS su COS con CD max(10, danno/2). Si perde a 0 PF e con i riposi.
- 0 PF (`statoVita`: in piedi / morente / stabile / morto): i TS contro morte (10+ successo, 1 = due fallimenti, 20 = 1 PF) si tirano nella card dei PF. Un danno a 0 PF vale un fallimento. Se il danno oltre lo 0 raggiunge i PF massimi è morte istantanea. La cura azzera i tiri. Il riposo lungo richiede almeno 1 PF.
- Salita di livello: disponibile quando gli XP raggiungono la soglia. Aggiunge PF medi e un Dado Vita. Gli aumenti di caratteristica si fanno a mano con "Modifica" nella tab Statistiche.
- La CA è calcolata senza armatura (10 + DES): Armatura Magica e altri oggetti non sono gestiti.

Non ancora implementati: creazione di un personaggio da zero (oggi si importa un JSON), eliminazione di account e personaggi, recupero della password dimenticata, interfaccia per armi e privilegi (i cataloghi ci sono, si riempiono da seed o import), limitazione del catalogo alle sole voci ufficiali, effetti attivi (Scudo, Armatura Magica, Immagine Speculare), condizioni e indebolimento, armature, note di sessione, modifica di tratti/armi dall'interfaccia, classi e razze diverse. Per aggiungere un'altra classe bisogna rendere generiche `SLOT_MAGO`, il Dado Vita d6 e le regole di preparazione in `regole.ts`.
