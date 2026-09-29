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

I dati stanno in un database SQLite sul computer che avvia l'app: è il file `archivio/dnd_player.sqlite`, creato al primo avvio ed escluso da git. Non serve installare nulla, perché il database è quello integrato in Node.js.

Ogni parte del personaggio ha la sua tabella (caratteristiche, slot, inventario, esperienza…). Incantesimi, armi, armature, privilegi, razze e background stanno in **cataloghi condivisi**, a cui i personaggi sono collegati: la descrizione di *Dardo Incantato* è scritta una volta sola e vale per tutti. I cataloghi ufficiali si trovano in [`server/semi/`](server/semi/). Contengono tutte le razze, i background, le armi e le armature del manuale e i privilegi di 1° livello delle classi, con descrizioni riassunte. Gli incantesimi per ora sono solo quelli di Alston e tre trucchetti di razza.

**Aggiornamento dalla versione precedente.** Al primo avvio un archivio della versione precedente, con una scheda JSON per personaggio, viene convertito da solo. Prima viene salvata una copia in `archivio/dnd_player.sqlite.bak-v1`. Utenti e password restano gli stessi, ma bisogna rifare l'accesso una volta.

**Da più dispositivi.** Con `npm run dev` (o `npm run preview`) l'app è raggiungibile da tutta la rete di casa: all'avvio Vite stampa l'indirizzo `Network`, per esempio `http://192.168.1.20:5173`. Ogni dispositivo carica gli aggiornamenti degli altri quando torni sulla pagina, e comunque ogni 15 secondi. Se due dispositivi modificano la scheda nello stesso momento, l'app chiede quale versione tenere.

**Offline.** Ogni modifica finisce anche nel `localStorage` del browser. Se il computer con il database non è raggiungibile, l'indicatore nell'intestazione passa a *Offline* e le modifiche vengono inviate appena torna disponibile.

**Backup.** Copia il file `archivio/dnd_player.sqlite`, oppure usa **Esporta JSON**. Dentro una scheda, **Importa JSON** la sostituisce (su tutti i dispositivi); dall'elenco dei personaggi ne crea una nuova. L'import accetta anche il formato delle versioni precedenti dell'app.

Il collegamento non è cifrato (http, non https): il login tiene fuori chi non ha la password, ma per ora l'app è pensata per la rete di casa. Non esporla su internet.

## Cosa non gestisce (ancora)

- Le risorse di classe (Ira, Ispirazione Bardica, Ki, Incanalare Divinità…) sono descritte tra i privilegi ma non si contano ancora nella scheda. Niente multiclasse.
- Il catalogo ha i privilegi di classe solo per il 1° livello (più quelli della Divinazione) e pochi incantesimi: salendo di livello, i privilegi mancanti vanno aggiunti a mano.
- Non si possono eliminare account e personaggi e non c'è il recupero della password dimenticata.
- *Armatura Magica*, *Scudo* e gli altri effetti attivi non vengono applicati alla CA.
- Nessuna gestione di condizioni e indebolimento.
- Tratti, privilegi e armi non si modificano dall'interfaccia: arrivano dalla scheda importata e dai cataloghi.

## Avvio

Serve Node.js 22.13 o successivo (per il modulo `node:sqlite`).

```bash
npm install
npm run dev        # http://localhost:5173
```

| Comando | Cosa fa |
|---|---|
| `npm run dev` | Server di sviluppo con ricaricamento automatico e database, accessibile dalla rete di casa |
| `npm test` | Test delle regole, del database e della migrazione (Vitest) |
| `npm run lint` | ESLint |
| `npm run build` | Controllo dei tipi e build di produzione in `dist/` |
| `npm run preview` | Serve la build di produzione, con il database |

Per correggere o ampliare i cataloghi ufficiali modifica i file in [`server/semi/`](server/semi/): vengono applicati al riavvio del server. [`src/dati/alston.ts`](src/dati/alston.ts) contiene la scheda di Alston usata come esempio e nei test.

## Com'è fatto

React 19, TypeScript, Vite e Tailwind CSS v4, con icone di [lucide-react](https://lucide.dev).

- [`src/regole.ts`](src/regole.ts): tutte le regole come funzioni pure (modificatori, slot, riposi, danni, lancio, PF, TS contro morte). I test sono in [`src/regole.test.ts`](src/regole.test.ts).
- [`src/dati/classi.ts`](src/dati/classi.ts): le regole delle 12 classi (Dado Vita, TS, competenze, incantesimi, sottoclassi, equipaggiamento iniziale).
- [`src/creazione.ts`](src/creazione.ts) e [`src/components/SchermataCreazione.tsx`](src/components/SchermataCreazione.tsx): la creazione di un personaggio.
- [`src/scheda.ts`](src/scheda.ts): validazione della scheda e conversione dei formati vecchi, usata sia dall'app sia dal server.
- [`src/salvataggio.ts`](src/salvataggio.ts) e [`src/sincronizzazione.ts`](src/sincronizzazione.ts): copia locale e sincronizzazione con il database.
- [`src/accesso.ts`](src/accesso.ts): chiamate all'API (accesso, registrazione, personaggi, catalogo).
- [`server/`](server/): lo schema del database e la sua migrazione, la conversione tra scheda e tabelle, i cataloghi con i loro seed, utenti e sessioni, e l'API `/api` montata nel server di Vite.
- [`src/components/`](src/components/): una tab per sezione, più la finestra dei tiri, la scheda degli incantesimi e il pannello del riposo breve.

La scheda contiene solo i dati di base del personaggio. Tutto ciò che si può calcolare, come modificatori, TS, CA e slot massimi, viene ricalcolato a ogni modifica, così i valori restano sempre coerenti. Le convenzioni per chi sviluppa sono in [`CLAUDE.md`](CLAUDE.md).
