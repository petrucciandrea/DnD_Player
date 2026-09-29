# DnD_Player

Scheda personaggio interattiva per giocare a **Dungeons & Dragons 5e** (regole del 2014), pensata per stare aperta sul tavolo durante la sessione. Non si limita a mostrare i numeri: applica le regole. Tiri, danni, slot, riposi, concentrazione e tiri salvezza contro morte si gestiscono dalla scheda, che aggiorna lo stato del personaggio.

Per ora gestisce un solo personaggio: **Alston il Breve**, Gnomo delle Rocce, Mago della Scuola di Divinazione. È un'app solo frontend. Non ci sono account né server e i dati restano nel browser.

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
- **Riposo lungo**: riporta PF e slot al massimo, recupera metà dei Dadi Vita, ritira il Presagio e rende di nuovo disponibile il Recupero Arcano. Serve almeno 1 PF.
- **Riposo breve**: un pannello in cui imposti la durata e spendi i Dadi Vita uno alla volta. Puoi aggiungere il Canto di Riposo di un bardo del gruppo, scegliere gli slot da recuperare con il Recupero Arcano e, se sei stabilizzato a 0 PF, tirare il d4 per il recupero di 1 PF. Il pannello mostra l'anteprima dei PF, e nulla viene applicato finché non premi *Completa riposo*.
- **Esporta / Importa JSON** e **Ripristina** (↺) i dati iniziali.

### Statistiche & Presagio

- Caratteristiche, tiri salvezza e le 18 abilità: basta un clic per tirare. I TS di INT, SAG e CAR ricordano l'**Astuzia Gnomesca**.
- **Armi**: il tiro per colpire propone subito i danni, a una o a due mani per le armi versatili. Con un 20 naturale i dadi dei danni raddoppiano, il modificatore no.
- **Presagio**: i d20 della Divinazione (2d20, che diventano 3d20 dal 14° livello), da segnare come usati.
- **Tira dadi rapido**: d4, d6, d8, d10, d12, d20.
- Con **Modifica** cambi i punteggi di caratteristica e le competenze nelle abilità. I PF massimi si ricalcolano quando cambia la COS.

### Grimorio

- **Slot incantesimo** per livello, da spendere o recuperare con un clic. I massimi seguono la tabella del Mago.
- **Preparazione**: l'app segna gli incantesimi preparati e fa rispettare il limite (livello + mod INT). Tiene anche il conto dei trucchetti.
- Cliccando un incantesimo si apre la sua **scheda**: gittata, componenti, durata, concentrazione, rituale e descrizione. Da lì lo **lanci**:
  - con uno slot di livello pari o superiore, se è preparato;
  - come **rituale**, senza spendere slot, anche se non è preparato;
  - come trucchetto, senza slot.

  Il lancio spende lo slot, imposta la concentrazione se serve e propone i tiri per colpire (uno per raggio, come in *Raggio Rovente*) e i danni. I danni **scalano** con lo slot usato, o con il livello del personaggio per i trucchetti. Un 1 naturale manca il bersaglio, un 20 raddoppia i dadi. Negli incantesimi con tiro salvezza vedi la CD e la metà dei danni per chi lo supera.
- Puoi aggiungere o rimuovere incantesimi. Solo quelli presenti nel catalogo interno hanno la scheda completa. Gli altri si lanciano ugualmente, ma solo per spendere lo slot.

### Zaino

Monete (mr, ma, me, mo, mp), oggetti con quantità e peso, e barra del carico rispetto alla capacità di trasporto (FOR × 15 lb).

### Progresso XP

Registro degli XP guadagnati, ognuno con un motivo e una data, e barra verso la soglia del livello successivo. Quando raggiungi la soglia compare **Sali di livello**, che aggiunge i PF medi (4 + COS) e un Dado Vita e ti ricorda cos'altro fare: nuovi incantesimi, aumenti di caratteristica, trucchetti.

### Tratti & Background

Tratti caratteriali, ideali, legami, difetti, biografia, dettagli fisici e privilegi di razza, classe e background.

## Salvataggio

La scheda si salva da sola nel `localStorage` del browser a ogni modifica. Per spostarla su un altro dispositivo, o per farne un backup, usa **Esporta JSON** e poi **Importa JSON**. L'import controlla il file e accetta anche il formato delle versioni precedenti dell'app.

Il salvataggio vale per quel browser su quel dispositivo: svuotare i dati del sito cancella la scheda. Esporta un backup di tanto in tanto.

## Cosa non gestisce (ancora)

- Un solo personaggio, e solo un Mago: slot, Dado Vita e preparazione sono quelli del Mago.
- La CA è calcolata senza armatura (10 + DES). *Armatura Magica*, *Scudo* e gli altri effetti attivi non vengono applicati.
- Nessuna gestione di condizioni e indebolimento.
- Tratti, privilegi e armi non si modificano dall'interfaccia: sono in [`src/dati/alston.ts`](src/dati/alston.ts).

## Avvio

Serve Node.js 20.19+ oppure 22.12+.

```bash
npm install
npm run dev        # http://localhost:5173
```

| Comando | Cosa fa |
|---|---|
| `npm run dev` | Server di sviluppo con ricaricamento automatico |
| `npm test` | Test delle regole (Vitest) |
| `npm run lint` | ESLint |
| `npm run build` | Controllo dei tipi e build di produzione in `dist/` |
| `npm run preview` | Serve la build di produzione |

Se modifichi i dati iniziali in `src/dati/alston.ts` e non vedi cambiamenti, è perché il browser carica la scheda salvata. Premi ↺ nell'intestazione per ripartire dai dati iniziali.

## Com'è fatto

React 19, TypeScript, Vite e Tailwind CSS v4, con icone di [lucide-react](https://lucide.dev).

- [`src/regole.ts`](src/regole.ts): tutte le regole come funzioni pure (modificatori, slot, riposi, danni, lancio, PF, TS contro morte). I test sono in [`src/regole.test.ts`](src/regole.test.ts).
- [`src/dati/`](src/dati/): i dati iniziali di Alston e il catalogo delle schede degli incantesimi.
- [`src/salvataggio.ts`](src/salvataggio.ts): salvataggio, import/export e migrazione dei vecchi formati.
- [`src/components/`](src/components/): una tab per sezione, più la finestra dei tiri, la scheda degli incantesimi e il pannello del riposo breve.

La scheda contiene solo i dati di base del personaggio. Tutto ciò che si può calcolare, come modificatori, TS, CA e slot massimi, viene ricalcolato a ogni modifica, così i valori restano sempre coerenti. Le convenzioni per chi sviluppa sono in [`CLAUDE.md`](CLAUDE.md).
