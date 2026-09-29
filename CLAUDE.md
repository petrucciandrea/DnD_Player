# CLAUDE.md — DnD_Player

Scheda personaggio interattiva per D&D 5e (**edizione 2014**), React 19, TypeScript (strict), Vite 8, Tailwind CSS v4. Il "backend" è un plugin di Vite che espone un archivio SQLite (`node:sqlite`, serve Node 22.13+) su `/api` (accesso, sessione, scheda): nessun server separato e nessuna dipendenza in più. I test (Vitest) coprono le regole. Repository git: `main` è il ramo stabile e si sviluppa sul branch `sviluppo`. Per ora gestisce un solo personaggio: Alston il Breve, Gnomo delle Rocce, Mago (Scuola di Divinazione).

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
| `src/tipi.ts` | Tipi: `CharacterData` (versione 2), `Spell`, `Arma`, `Privilegio`, `SetChar`… |
| `src/regole.ts` | Regole pure: tabelle di XP, slot del Mago, abilità e scuole; `derivate()`, riposi, livelli, danni (`Danni`, `critico`, `dannoArma`, `dannoIncantesimo`), lancio (`lanciaIncantesimo`), PF (`applicaDanno`, `applicaCura`, `esitoTsMorte`, `statoVita`), `risultatoD20`, `tiraD()` |
| `src/regole.test.ts` | Test Vitest delle regole e della migrazione dei salvataggi |
| `src/dati/alston.ts` | `INITIAL_CHARACTER`, i dati iniziali di Alston |
| `src/dati/incantesimi.ts` | `SCHEDE_INCANTESIMI`: schede sintetiche degli incantesimi (gittata, durata, concentrazione, rituale, attacco, TS, danni e come scalano), collegate agli incantesimi del personaggio **per nome** |
| `src/tiroDadi.ts` | `useRichiestaTiro()` → `chiediTiro`, `chiediD20` (normale / vantaggio / svantaggio), `tiraDanni` |
| `src/accesso.ts` | `sessioneAttuale()`, `accedi()`, `esci()` e il tipo `Utente` (`username`, `personaggio`) |
| `src/salvataggio.ts` | Caricamento e salvataggio su `localStorage` (per id del personaggio), chiamate all'API (`scaricaDalServer`, `inviaAlServer`), import/export JSON, migrazione dal vecchio formato |
| `src/sincronizzazione.ts` | `useSincronizzazione(personaggio, char, setChar, onSessioneScaduta)`: allinea la scheda con l'archivio del server e restituisce lo stato mostrato nell'intestazione |
| `server/archivio.ts` | Archivio SQLite puro (`apriArchivio`, `leggi`, `scrivi` con revisione), testato in `server/archivio.test.ts` |
| `server/accesso.ts` | Utenti e sessioni (`verificaCredenziali`, `apriSessione`, `leggiSessione`, `chiudiSessione`, `UTENTI_INIZIALI`), testato in `server/accesso.test.ts` |
| `server/api.ts` | Plugin Vite `apiPersonaggio()` su `/api` in dev e in preview: `POST /accesso`, `GET /sessione`, `POST /uscita`, `GET`/`PUT /personaggio`. File `archivio/dnd_player.sqlite` (in `.gitignore`), oppure quello indicato da `DND_ARCHIVIO` |
| `src/App.tsx` | `App` verifica la sessione e mostra `SchermataAccesso` o `Scheda`: intestazione (PF, riposi, import/export, uscita) e navigazione tra le tab |
| `src/components/Tab*.tsx` | Una tab ciascuno: Statistiche, Grimorio, Zaino, Progresso, Lore |
| `src/components/` (altri) | `DialogoTiro` (finestra di ogni tiro), `FinestraIncantesimo` (scheda e lancio), `PannelloRiposoBreve`, `TiriMorte` (card PF a 0 PF) |

- **Dati grezzi e valori derivati.** `CharacterData` contiene solo dati grezzi. Tutto ciò che si calcola (modificatori, TS, abilità, CA, iniziativa, CD e attacco magico, bonus competenza, slot massimi, limite di preparazione, soglia XP, attacco e danno delle armi) viene da `derivate(char)`, calcolata a ogni render in `App` e passata alle tab come `d`. **Non memorizzare nello stato un valore derivabile e non scriverlo a mano nel JSX:** aggiungilo a `derivate()`.
- **Stato.** Un solo `useState<CharacterData>` in `App`, aggiornato in modo immutabile con `setChar(prev => ...)`. Le tab ricevono `char`, `d` e `setChar`. Lo stato solo di interfaccia (input dei form, ultimo tiro) resta locale nella tab.
- **Tiri di dado.** Ogni tiro passa da `chiediTiro()` o, per i d20, da `chiediD20()` (`src/tiroDadi.ts`); per i danni c'è `tiraDanni()`. Tutti aprono `components/DialogoTiro.tsx`. L'utente sceglie se inserire i risultati dei propri dadi fisici o se far tirare l'app. È una richiesta esplicita dell'utente: **non chiamare mai `tiraD` direttamente in una funzionalità**. `chiediTiro` restituisce una Promise con i risultati (`null` se l'utente annulla), quindi gli handler sono `async`. Il tiro avviene **fuori** dall'updater di `setChar`, perché in StrictMode React chiama l'updater due volte, e gli esiti vengono passati alle funzioni pure (vedi `riposoLungo(c, presagio)`). `App` crea `chiediTiro` e `chiediD20` con `useRichiestaTiro()` e li passa alle tab che ne hanno bisogno.
- **Slot.** `slotSpesi` è un array di 9 elementi (indice 0 = slot di 1° livello). I massimi vengono da `SLOT_MAGO[livello - 1]`.

## Accesso

- Senza una sessione valida l'API risponde 401 a tutto tranne `POST /api/accesso`. Il personaggio da leggere e scrivere viene dall'utente della sessione, mai dal client.
- Tabelle `utenti(username, hash, personaggio)` e `sessioni(token, username, scadenza)`, create da `apriArchivio`. Le password sono hash `scrypt$sale$hash`. Delle sessioni si salva solo lo SHA-256 del token; il token sta nel cookie `dnd_sessione` (HttpOnly, SameSite=Strict, 30 giorni). Un accesso fallito risponde dopo 1 s.
- `UTENTI_INIZIALI` in `server/accesso.ts` contiene `alan` → `alston` e viene inserito con `INSERT OR IGNORE` a ogni apertura: cambiarne l'hash lì non modifica un archivio già creato. **Non scrivere password in chiaro nel codice, nei test o nella documentazione:** genera l'hash con `hashPassword()`.
- Se il server risponde 401 durante l'uso (sessione scaduta), `useSincronizzazione` chiama `onSessioneScaduta` e `App` torna al login. Le modifiche non inviate restano in `localStorage` e partono al prossimo accesso.

## Salvataggio

- **Fonte di verità: l'archivio SQLite** (`archivio/dnd_player.sqlite`, una riga per personaggio con id `alston`, JSON della scheda e `revisione`). Il `localStorage` (chiave `dnd_<personaggio>_character`, per Alston `dnd_alston_character`) è una copia offline: all'avvio la scheda si mostra subito da lì, poi arriva quella del server. Se l'archivio è vuoto ci si copia la scheda del browser.
- **Sincronizzazione** (`useSincronizzazione`, al posto del vecchio `useEffect` con `salva`): ogni modifica va subito nel `localStorage` e dopo 500 ms al server con `PUT { dati, revisione }`. Il server accetta solo se la revisione coincide, altrimenti risponde 409 con la versione attuale e il client chiede con `confirm()` quale tenere. La revisione di riferimento e il flag delle modifiche non inviate stanno in `localStorage` (`dnd_<personaggio>_sincronizzazione`), così nulla va perso chiudendo la pagina o andando offline. Gli aggiornamenti degli altri dispositivi si scaricano all'avvio, al focus o al ritorno sulla pagina, e ogni 15 s.
- Il salvataggio ha la precedenza su `INITIAL_CHARACTER`: se modifichi i dati iniziali, l'app mostra ancora quelli salvati. Per vederli usa il pulsante ↺ (Ripristina) nell'intestazione, che però vale per tutti i dispositivi.
- `server.host` e `preview.host` sono `true`: l'app è raggiungibile da tutta la rete locale, protetta dal login ma su http non cifrato. Va bene per la rete di casa, non per esporla su internet.
- Il server non valida la scheda (controlla solo che `dati` sia un oggetto): la validazione resta `daJSON()` sul client, anche per ciò che arriva dal server.
- `daJSON()` valida i dati e li normalizza, completando le sezioni mancanti con `INITIAL_CHARACTER`. Converte anche il vecchio formato senza `versione` (`migraV1`). **Se cambi la forma di `CharacterData`**, aggiorna `normalizza()`. Se il cambiamento non è compatibile, porta `versione` a 3 e aggiungi una migrazione: i dati salvati degli utenti non devono andare persi.

## Attenzione

- **`src/index.css` deve restare minimale.** Tailwind v4 mette le utility in `@layer` e qualunque CSS fuori dai layer vince su di esse. Il vecchio CSS del template rendeva il nome del personaggio illeggibile. Gli stili vanno scritti come classi Tailwind nel JSX.
- Tailwind v4 si configura tramite il plugin `@tailwindcss/vite`: non ci sono `tailwind.config.js` né `postcss.config.js`.
- `react-refresh/only-export-components`: i file in `components/` devono esportare solo componenti. Costanti e funzioni condivise vanno in `regole.ts`.
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

Non ancora implementati: gestione degli utenti dall'interfaccia (si aggiungono in `UTENTI_INIZIALI`; archivio e API supportano già un personaggio per utente), effetti attivi (Scudo, Armatura Magica, Immagine Speculare), condizioni e indebolimento, armature, note di sessione, modifica di tratti/armi dall'interfaccia, classi e razze diverse. Per aggiungere un'altra classe bisogna rendere generiche `SLOT_MAGO`, il Dado Vita d6 e le regole di preparazione in `regole.ts`.
