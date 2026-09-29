# CLAUDE.md

Scheda personaggio interattiva per D&D 5e (**edizione 2014**), solo frontend: React 19, TypeScript (strict), Vite 8, Tailwind CSS v4. Non c'è backend. I test (Vitest) coprono le regole. Repository git: `main` è il ramo stabile e si sviluppa sul branch `sviluppo`. Per ora gestisce un solo personaggio: Alston il Breve, Gnomo delle Rocce, Mago (Scuola di Divinazione).

## Comandi

```bash
npm run dev      # dev server Vite (http://localhost:5173)
npm run build    # tsc -b (type check) + vite build → dist/
npm run lint     # ESLint (typescript-eslint + react-hooks + react-refresh)
npm test         # Vitest (src/**/*.test.ts)
npm run preview  # serve la build di produzione
```

Prima di dichiarare finito un lavoro, esegui `npm test`, `npm run lint` e `npm run build`: devono passare tutti senza errori. Ogni nuova regola in `regole.ts` va accompagnata da un test in `src/regole.test.ts`.

## Architettura

| File | Contenuto |
|---|---|
| `src/tipi.ts` | Tipi: `CharacterData` (versione 2), `Spell`, `Arma`, `Privilegio`, `SetChar`… |
| `src/regole.ts` | Regole pure: tabelle di XP, slot del Mago, abilità e scuole; `derivate()`, `riposoLungo()`, `saliDiLivello()`, `modificaCaratteristica()`, `tiraD()` |
| `src/dati/alston.ts` | `INITIAL_CHARACTER`, i dati iniziali di Alston |
| `src/salvataggio.ts` | Caricamento e salvataggio su `localStorage`, import/export JSON, migrazione dal vecchio formato |
| `src/App.tsx` | Intestazione (PF, riposi, import/export) e navigazione tra le tab |
| `src/components/Tab*.tsx` | Una tab ciascuno: Statistiche, Grimorio, Zaino, Progresso, Lore |

- **Dati grezzi e valori derivati.** `CharacterData` contiene solo dati grezzi. Tutto ciò che si calcola (modificatori, TS, abilità, CA, iniziativa, CD e attacco magico, bonus competenza, slot massimi, limite di preparazione, soglia XP, attacco e danno delle armi) viene da `derivate(char)`, calcolata a ogni render in `App` e passata alle tab come `d`. **Non memorizzare nello stato un valore derivabile e non scriverlo a mano nel JSX:** aggiungilo a `derivate()`.
- **Stato.** Un solo `useState<CharacterData>` in `App`, aggiornato in modo immutabile con `setChar(prev => ...)`. Le tab ricevono `char`, `d` e `setChar`. Lo stato solo di interfaccia (input dei form, ultimo tiro) resta locale nella tab.
- **Tiri di dado.** Ogni tiro passa da `chiediTiro()` (`src/tiroDadi.ts`), che apre `components/DialogoTiro.tsx`. L'utente sceglie se inserire i risultati dei propri dadi fisici o se far tirare l'app. È una richiesta esplicita dell'utente: **non chiamare mai `tiraD` direttamente in una funzionalità**. `chiediTiro` restituisce una Promise con i risultati (`null` se l'utente annulla), quindi gli handler sono `async`. Il tiro avviene **fuori** dall'updater di `setChar`, perché in StrictMode React chiama l'updater due volte, e gli esiti vengono passati alle funzioni pure (vedi `riposoLungo(c, presagio)`). `App` crea `chiediTiro` con `useRichiestaTiro()` e lo passa alle tab che ne hanno bisogno.
- **Slot.** `slotSpesi` è un array di 9 elementi (indice 0 = slot di 1° livello). I massimi vengono da `SLOT_MAGO[livello - 1]`.

## Salvataggio

- La chiave di `localStorage` è `dnd_alston_character`. Il salvataggio ha la precedenza su `INITIAL_CHARACTER`: se modifichi i dati iniziali, il browser mostra ancora quelli salvati. Per vederli usa il pulsante ↺ (Ripristina) nell'intestazione.
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
- Salita di livello: disponibile quando gli XP raggiungono la soglia. Aggiunge PF medi e un Dado Vita. Gli aumenti di caratteristica si fanno a mano con "Modifica" nella tab Statistiche.
- La CA è calcolata senza armatura (10 + DES): Armatura Magica e altri oggetti non sono gestiti.

Non ancora implementati: tiri salvezza contro morte, condizioni, concentrazione, armature, più personaggi, classi e razze diverse. Per aggiungere un'altra classe bisogna rendere generiche `SLOT_MAGO`, il Dado Vita d6 e le regole di preparazione in `regole.ts`.
