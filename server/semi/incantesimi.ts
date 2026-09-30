import type { SchedaIncantesimo } from "../../src/tipi.ts";
import type { NomeClasse } from "../../src/dati/classi.ts";
import { CLASSI_SOTTOCLASSI, SCHEDE_SOTTOCLASSI } from "./incantesimiSottoclassi.ts";

// Catalogo ufficiale (creato_da NULL): a ogni avvio aggiorna la tabella `incantesimi` dell'archivio.
// Schede complete (D&D 5e 2014, testi e gittate come nel manuale italiano).
const SCHEDE_BASE: Record<string, SchedaIncantesimo> = {
  "Dardo di Fuoco": {
    livello: 0, scuola: "Invocazione", tempo: "1 azione", gittata: "36 metri", componenti: "V, S", durata: "Istantanea",
    concentrazione: false, rituale: false,
    descrizione: "L'incantatore scaglia una scintilla di fuoco verso una creatura o un oggetto situato entro gittata, effettuando un attacco a distanza con questo incantesimo contro il bersaglio. Se colpisce, il bersaglio subisce 1d10 danni da fuoco. Un oggetto infiammabile colpito da questo incantesimo si incendia se non è indossato o trasportato.",
    livelloSuperiore: "1° livello: 1d10\n5° livello: 2d10\n11° livello: 3d10\n17° livello: 4d10",
    attacco: { numero: 1 },
    danni: { dado: "1d10", tipo: "da fuoco", trucchetto: true, perAttacco: true },
  },
  "Interdizione alle Lame": {
    livello: 0, scuola: "Abiurazione", tempo: "1 azione", gittata: "Incantatore", componenti: "V, S", durata: "1 round",
    concentrazione: false, rituale: false,
    descrizione: "L'incantatore protende la mano in avanti e traccia un simbolo di interdizione nell'aria. Fino alla fine del suo turno successivo, l'incantatore dispone di resistenza ai danni contundenti, perforanti e taglienti inferti dagli attacchi con le armi.",
  },
  "Tocco Gelido": {
    livello: 0, scuola: "Necromanzia", tempo: "1 azione", gittata: "36 metri", componenti: "V, S", durata: "1 round",
    concentrazione: false, rituale: false,
    descrizione: "L'incantatore crea una mano scheletrica e spettrale nello spazio di una creatura entro gittata, effettuando un attacco a distanza con questo incantesimo contro quella creatura per colpirla con un flusso di gelo sepolcrale. Se viene colpito, il bersaglio subisce 1d8 danni necrotici e non può recuperare punti ferita fino all'inizio del turno successivo dell'incantatore. Fino ad allora, la mano si avvinghia al bersaglio.\n\nSe l'incantatore colpisce un bersaglio non morto, quel bersaglio subisce anche svantaggio ai suoi tiri per colpire contro l'incantatore fino alla fine del turno successivo di quest'ultimo.",
    livelloSuperiore: "1° livello: 1d8\n5° livello: 2d8\n11° livello: 3d8\n17° livello: 4d8",
    attacco: { numero: 1 },
    danni: { dado: "1d8", tipo: "necrotici", trucchetto: true, perAttacco: true },
  },
  "Charm su Persone": {
    livello: 1, scuola: "Ammaliamento", tempo: "1 azione", gittata: "9 metri", componenti: "V, S", durata: "1 ora",
    concentrazione: false, rituale: false,
    descrizione: "L'incantatore tenta di affascinare un umanoide entro gittata e che egli sia in grado di vedere. L'umanoide deve effettuare un tiro salvezza su Saggezza e dispone di vantaggio se l'incantatore o i suoi compagni stanno combattendo contro di lui. Se lo fallisce, è affascinato dall'incantatore finché l'incantesimo non termina o finché l'incantatore o i suoi compagni non lo danneggiano in qualche modo. La creatura affascinata considera l'incantatore una figura conosciuta e amichevole. Quando l'incantesimo termina, la creatura capirà di essere stata affascinata dall'incantatore.",
    livelloSuperiore: "Quando l'incantatore lancia questo incantesimo usando uno slot incantesimo di 2° livello o superiore, può bersagliare una creatura aggiuntiva per ogni slot di livello superiore al 1°. Le creature devono trovarsi a non più di 9 metri l'una dall'altra quando l'incantatore le bersaglia.",
    tiroSalvezza: { car: "SAG", effetto: "nessun effetto" },
  },
  "Dardo Incantato": {
    livello: 1, scuola: "Invocazione", tempo: "1 azione", gittata: "36 metri", componenti: "V, S", durata: "Istantanea",
    concentrazione: false, rituale: false,
    descrizione: "L'incantatore crea tre dardi lucenti di forza magica. Ogni dardo colpisce una creatura scelta dall'incantatore, situata entro gittata e che egli sia in grado di vedere. Un dardo infligge 1d4+1 danni da forza al suo bersaglio. Tutti i dardi colpiscono simultaneamente e l'incantatore può dirigerli per colpire una sola creatura o più creature.",
    livelloSuperiore: "Quando l'incantatore lancia questo incantesimo usando uno slot incantesimo di 2° livello o superiore, l'incantesimo crea un dardo aggiuntivo per ogni slot di livello superiore al 1°.",
    danni: { dado: "3d4", mod: 3, tipo: "da forza", perLivello: "1d4", modPerLivello: 1 },
  },
  "Individuazione del Magico": {
    livello: 1, scuola: "Divinazione", tempo: "1 azione", gittata: "Incantatore", componenti: "V, S", durata: "Concentrazione, fino a 10 minuti",
    concentrazione: true, rituale: true,
    descrizione: "Per la durata dell'incantesimo, l'incantatore percepisce la presenza della magia entro 9 metri da lui. Se percepisce la magia in questo modo, può usare la sua azione per vedere una debole aura attorno a ogni creatura o oggetto visibile nell'area e che contenga magia, e apprende di che scuola di magia si tratta, se ne esiste una.\n\nL'incantesimo può penetrare la maggior parte delle barriere, ma è bloccato da 30 cm di pietra, 2,5 cm di metallo comune, una sottile lamina di piombo o 90 cm di legno o terriccio.",
  },
  "Mani Brucianti": {
    livello: 1, scuola: "Invocazione", tempo: "1 azione", gittata: "Incantatore (cono di 4,5 metri)", componenti: "V, S", durata: "Istantanea",
    concentrazione: false, rituale: false,
    descrizione: "L'incantatore apre le mani, punta i pollici l'uno contro l'altro e dalla punta delle sue dita protese si propaga un sottile velo di fiamme. Ogni creatura entro un cono di 4,5 metri deve effettuare un tiro salvezza su Destrezza. Se lo fallisce, subisce 3d6 danni da fuoco, mentre se lo supera, subisce soltanto la metà di quei danni. Il fuoco incendia ogni oggetto infiammabile nell'area che non sia indossato o trasportato.",
    livelloSuperiore: "Quando l'incantatore lancia questo incantesimo usando uno slot incantesimo di 2° livello o superiore, i danni aumentano di 1d6 per ogni slot di livello superiore al 1°.",
    tiroSalvezza: { car: "DES", effetto: "metà danni" },
    danni: { dado: "3d6", tipo: "da fuoco", perLivello: "1d6" },
  },
  "Onda Tuonante": {
    livello: 1, scuola: "Invocazione", tempo: "1 azione", gittata: "Incantatore (cubo con spigolo di 4,5 metri)", componenti: "V, S", durata: "Istantanea",
    concentrazione: false, rituale: false,
    descrizione: "Un'ondata di energia tonante si propaga dall'incantatore. Ogni creatura entro un cubo con spigolo di 4,5 metri originato dall'incantatore deve effettuare un tiro salvezza su Costituzione. Se lo fallisce, subisce 2d8 danni da tuono e viene spinta di 3 metri più lontana dall'incantatore, mentre se lo supera, subisce soltanto la metà di quei danni e non viene spinta.\n\nInoltre, gli oggetti non fissati e completamente situati all'interno dell'area di effetto vengono automaticamente spinti 3 metri più lontani dall'incantatore a seguito dell'effetto dell'incantesimo. L'incantesimo emette un rombo tonante udibile fino a 90 metri di distanza.",
    livelloSuperiore: "Quando l'incantatore lancia questo incantesimo usando uno slot incantesimo di 2° livello o superiore, i danni aumentano di 1d8 per ogni slot di livello superiore al 1°.",
    tiroSalvezza: { car: "COS", effetto: "metà danni e non viene spinto" },
    danni: { dado: "2d8", tipo: "da tuono", perLivello: "1d8" },
  },
  "Raggio di Infermità": {
    livello: 1, scuola: "Necromanzia", tempo: "1 azione", gittata: "18 metri", componenti: "V, S", durata: "Istantanea",
    concentrazione: false, rituale: false,
    descrizione: "Un raggio di nauseante energia verdastra sfreccia verso una creatura entro gittata. L'incantatore effettua un attacco con incantesimo a distanza contro il bersaglio. Se lo colpisce, il bersaglio subisce 2d8 danni da veleno e deve effettuare un tiro salvezza su Costituzione. Se lo fallisce, è avvelenato fino alla fine del turno successivo dell'incantatore.",
    livelloSuperiore: "Quando l'incantatore lancia questo incantesimo usando uno slot incantesimo di 2° livello o superiore, i danni aumentano di 1d8 per ogni slot di livello superiore al 1°.",
    attacco: { numero: 1 },
    tiroSalvezza: { car: "COS", effetto: "non è avvelenata (i danni restano)" },
    danni: { dado: "2d8", tipo: "da veleno", perLivello: "1d8", perAttacco: true },
  },
  "Risata Incontenibile di Tasha": {
    livello: 1, scuola: "Ammaliamento", tempo: "1 azione", gittata: "9 metri", componenti: "V, S, M (una manciata di briciole e una piuma da agitare in aria)", durata: "Concentrazione, fino a 1 minuto",
    concentrazione: true, rituale: false,
    descrizione: "Una creatura a scelta dell'incantatore, situata entro gittata e che egli sia in grado di vedere, percepisce ogni cosa come esilarante ed è scossa da una spasmodica risata se questo incantesimo la influenza. Il bersaglio deve superare un tiro salvezza su Saggezza, altrimenti cade a terra prono, diventa incapacitato e non è in grado di rialzarsi per la durata dell'incantesimo. Una creatura con un punteggio di intelligenza pari o inferiore a 4 non è influenzata dall'incantesimo.\n\nAlla fine di ogni suo turno e ogni volta che subisce danni, il bersaglio può effettuare un altro tiro salvezza su Saggezza. Il bersaglio dispone di vantaggio al tiro salvezza se esso è innescato dai danni. In caso di successo, l'incantesimo termina.",
    tiroSalvezza: { car: "SAG", effetto: "nessun effetto" },
  },
  "Ritirata Rapida": {
    livello: 1, scuola: "Trasmutazione", tempo: "1 azione bonus", gittata: "Incantatore", componenti: "V, S", durata: "Concentrazione, fino a 10 minuti",
    concentrazione: true, rituale: false,
    descrizione: "Questo incantesimo consente all'incantatore di muoversi a una velocità straordinaria. Quando lancia questo incantesimo, e poi come azione bonus a ogni suo turno finché l'incantesimo non termina, l'incantatore può effettuare l'azione Scatto.",
  },
  "Scudo": {
    livello: 1, scuola: "Abiurazione", tempo: "1 reazione, che l'incantatore effettua quando è colpito da un attacco o bersagliato dall'incantesimo dardo incantato", gittata: "Incantatore", componenti: "V, S", durata: "1 round",
    concentrazione: false, rituale: false,
    descrizione: "Una barriera di forza magica invisibile si materializza e protegge l'incantatore. Fino all'inizio del proprio turno successivo, l'incantatore ottiene un bonus +5 alla CA da applicare anche all'attacco innescante e non subisce danni dall'incantesimo dardo incantato.",
  },
  "Blocca Persone": {
    livello: 2, scuola: "Ammaliamento", tempo: "1 azione", gittata: "18 metri", componenti: "V, S, M (una piccola sbarra di ferro)", durata: "Concentrazione, fino a 1 minuto",
    concentrazione: true, rituale: false,
    descrizione: "L'incantatore sceglie un umanoide entro gittata e che egli sia in grado di vedere. Il bersaglio deve superare un tiro salvezza su Saggezza, altrimenti sarà paralizzato per la durata dell'incantesimo. Alla fine di ogni suo turno, il bersaglio può effettuare un altro tiro salvezza su Saggezza. Se lo supera, l'incantesimo su di esso termina.",
    livelloSuperiore: "Quando l'incantatore lancia questo incantesimo usando uno slot incantesimo di 3° livello o superiore, può bersagliare un umanoide aggiuntivo per ogni slot di livello superiore al 2°. Gli umanoidi devono trovarsi a non più di 9 metri l'uno dall'altro quando l'incantatore li bersaglia.",
    tiroSalvezza: { car: "SAG", effetto: "nessun effetto" },
  },
  "Immagine Speculare": {
    livello: 2, scuola: "Illusione", tempo: "1 azione", gittata: "Incantatore", componenti: "V, S", durata: "1 minuto",
    concentrazione: false, rituale: false,
    descrizione: "Tre duplicati illusori dell'incantatore compaiono nel suo spazio. Finché l'incantesimo non termina, i duplicati si muovono assieme a lui e imitano le sue azioni, cambiando posizione in modo che sia impossibile individuare quale immagine sia quella vera. L'incantatore può usare la sua azione per congedare i duplicati illusori.\n\nOgni volta che una creatura bersaglia l'incantatore con un attacco, l'incantatore tira un d20 per determinare se l'attacco bersaglia invece uno dei duplicati. Se l'incantatore possiede tre duplicati, deve ottenere al tiro un 6 o più per spostare il bersaglio dell'attacco su un duplicato. Se possiede due duplicati, deve ottenere al tiro un 8 o più. Se possiede un duplicato, deve ottenere al tiro un 11 o più.\n\nLa CA di un duplicato è pari a 10 + il modificatore di Destrezza dell'incantatore. Se un attacco colpisce un duplicato, esso viene distrutto. Un duplicato può essere distrutto solo da un attacco che lo colpisce. Ignora tutti gli altri danni ed effetti. L'incantesimo termina quando tutti e tre i duplicati sono distrutti.\n\nUna creatura non è influenzata da questo incantesimo se non può vedere, se si affida ai sensi diversi dalla vista, come per esempio la vista cieca, o se può percepire le illusioni come false, nel caso sia dotata di vista pura.",
  },
  "Raggio Rovente": {
    livello: 2, scuola: "Invocazione", tempo: "1 azione", gittata: "36 metri", componenti: "V, S", durata: "Istantanea",
    concentrazione: false, rituale: false,
    descrizione: "L'incantatore crea tre raggi di fuoco e li scaglia contro uno o più bersagli entro gittata. L'incantatore effettua un attacco con incantesimo a distanza per ogni raggio. Se colpisce, il bersaglio subisce 2d6 danni da fuoco.",
    livelloSuperiore: "Quando l'incantatore lancia questo incantesimo usando uno slot incantesimo di 3° livello o superiore, crea un raggio aggiuntivo per ogni slot di livello superiore al 2°.",
    attacco: { numero: 3, perLivello: 1 },
    danni: { dado: "2d6", tipo: "da fuoco", perAttacco: true },
  },
  // Trucchetti concessi dalle razze (descrizioni riassunte).
  "Illusione Minore": {
    livello: 0, scuola: "Illusione", tempo: "1 azione", gittata: "9 metri", componenti: "S, M (un pezzetto di vello)", durata: "1 minuto",
    concentrazione: false, rituale: false,
    descrizione: "Crea un suono o l'immagine di un oggetto (non più grande di un cubo di 1,5 m) entro gittata, per la durata. L'immagine non produce suoni, luce o odori e un'interazione fisica rivela che è un'illusione. Con un'azione, una prova di Intelligenza (Indagare) contro la CD degli incantesimi permette di capire che è falsa.",
  },
  "Luci Danzanti": {
    livello: 0, scuola: "Invocazione", tempo: "1 azione", gittata: "36 metri", componenti: "V, S, M (un po' di fosforo)", durata: "Concentrazione, fino a 1 minuto",
    concentrazione: true, rituale: false,
    descrizione: "Crea fino a quattro luci simili a torce (o una figura luminosa vagamente umanoide) che fluttuano entro gittata e illuminano con luce fioca per 3 m. Con un'azione bonus le sposta fino a 18 m; una luce si spegne se esce dalla gittata.",
  },
  "Taumaturgia": {
    livello: 0, scuola: "Trasmutazione", tempo: "1 azione", gittata: "9 metri", componenti: "V", durata: "Fino a 1 minuto",
    concentrazione: false, rituale: false,
    descrizione: "Manifesta un piccolo prodigio: voce tonante, fiamme che tremolano o cambiano colore, lievi scosse del terreno, un suono istantaneo, porte o finestre che si aprono o chiudono di scatto, occhi che cambiano aspetto. Fino a tre effetti attivi contemporaneamente.",
  },
};

// Classi che hanno l'incantesimo nella propria lista (tabella `incantesimo_classi`).
const CLASSI_BASE: Record<string, NomeClasse[]> = {
  "Dardo di Fuoco": ["Mago", "Stregone"],
  "Interdizione alle Lame": ["Bardo", "Mago", "Stregone", "Warlock"],
  "Tocco Gelido": ["Mago", "Stregone", "Warlock"],
  "Charm su Persone": ["Bardo", "Druido", "Mago", "Stregone", "Warlock"],
  "Dardo Incantato": ["Mago", "Stregone"],
  "Individuazione del Magico": ["Bardo", "Chierico", "Druido", "Mago", "Paladino", "Ranger", "Stregone"],
  "Mani Brucianti": ["Mago", "Stregone"],
  "Onda Tuonante": ["Bardo", "Druido", "Mago", "Stregone"],
  "Raggio di Infermità": ["Mago", "Stregone"],
  "Risata Incontenibile di Tasha": ["Bardo", "Mago"],
  "Ritirata Rapida": ["Mago", "Stregone", "Warlock"],
  "Scudo": ["Mago", "Stregone"],
  "Blocca Persone": ["Bardo", "Chierico", "Druido", "Mago", "Stregone", "Warlock"],
  "Immagine Speculare": ["Mago", "Stregone", "Warlock"],
  "Raggio Rovente": ["Mago", "Stregone"],
  "Illusione Minore": ["Bardo", "Mago", "Stregone", "Warlock"],
  "Luci Danzanti": ["Bardo", "Mago", "Stregone"],
  "Taumaturgia": ["Chierico"],
};

// Con gli incantesimi di dominio, giuramento, circolo e patrono (incantesimiSottoclassi.ts).
export const SCHEDE_INCANTESIMI: Record<string, SchedaIncantesimo> = { ...SCHEDE_BASE, ...SCHEDE_SOTTOCLASSI };
export const CLASSI_INCANTESIMI: Record<string, NomeClasse[]> = { ...CLASSI_BASE, ...CLASSI_SOTTOCLASSI };
