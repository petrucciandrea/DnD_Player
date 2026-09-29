import type { Caratteristica } from "../tipi";

export interface SchedaIncantesimo {
  livello: number;
  scuola: string;
  tempo: string;
  gittata: string;
  componenti: string;
  durata: string;
  concentrazione: boolean;
  rituale: boolean;
  descrizione: string;
  livelloSuperiore?: string;
  attacco?: { numero: number; perLivello?: number }; // tiri per colpire con incantesimo (es. raggi)
  tiroSalvezza?: { car: Caratteristica; effetto: string };
  danni?: {
    dado: string;
    tipo: string; // si legge dopo "danni": "da fuoco", "necrotici"...
    mod?: number;
    perLivello?: string; // dadi aggiunti per ogni livello di slot sopra quello base
    modPerLivello?: number;
    trucchetto?: boolean; // i dadi aumentano al 5°, 11° e 17° livello del personaggio
    perAttacco?: boolean; // il danno si tira per ogni tiro per colpire
  };
}

// Schede sintetiche (D&D 5e 2014, gittate in metri come nel manuale italiano).
export const SCHEDE_INCANTESIMI: Record<string, SchedaIncantesimo> = {
  "Dardo di Fuoco": {
    livello: 0, scuola: "Invocazione", tempo: "1 Azione", gittata: "36 m", componenti: "V, S", durata: "Istantanea",
    concentrazione: false, rituale: false,
    descrizione: "Scagli un dardo di fuoco contro una creatura o un oggetto. Un oggetto infiammabile colpito, se non indossato o trasportato, prende fuoco.",
    attacco: { numero: 1 },
    danni: { dado: "1d10", tipo: "da fuoco", trucchetto: true, perAttacco: true },
  },
  "Interdizione alle Lame": {
    livello: 0, scuola: "Abiurazione", tempo: "1 Azione", gittata: "Incantatore", componenti: "V, S", durata: "1 round",
    concentrazione: false, rituale: false,
    descrizione: "Fino alla fine del tuo prossimo turno hai resistenza ai danni contundenti, perforanti e taglienti inflitti da attacchi con armi.",
  },
  "Tocco Gelido": {
    livello: 0, scuola: "Necromanzia", tempo: "1 Azione", gittata: "36 m", componenti: "V, S", durata: "1 round",
    concentrazione: false, rituale: false,
    descrizione: "Una mano spettrale afferra il bersaglio. Se colpito, non può recuperare PF fino all'inizio del tuo prossimo turno; se è un non morto, ha anche svantaggio ai tiri per colpire contro di te fino ad allora.",
    attacco: { numero: 1 },
    danni: { dado: "1d8", tipo: "necrotici", trucchetto: true, perAttacco: true },
  },
  "Charm su Persone": {
    livello: 1, scuola: "Ammaliamento", tempo: "1 Azione", gittata: "9 m", componenti: "V, S", durata: "1 ora",
    concentrazione: false, rituale: false,
    descrizione: "Un umanoide che vedi è affascinato da te e ti considera un conoscente amichevole. Ha vantaggio al TS se tu o i tuoi compagni lo state combattendo. Quando l'effetto termina, sa di essere stato affascinato.",
    livelloSuperiore: "Un bersaglio aggiuntivo per ogni livello di slot sopra il 1°.",
    tiroSalvezza: { car: "SAG", effetto: "nessun effetto" },
  },
  "Dardo Incantato": {
    livello: 1, scuola: "Invocazione", tempo: "1 Azione", gittata: "36 m", componenti: "V, S", durata: "Istantanea",
    concentrazione: false, rituale: false,
    descrizione: "Crei tre dardi di forza che colpiscono automaticamente, ognuno per 1d4 + 1 danni. Puoi indirizzarli su uno o più bersagli.",
    livelloSuperiore: "Un dardo in più per ogni livello di slot sopra il 1°.",
    danni: { dado: "3d4", mod: 3, tipo: "da forza", perLivello: "1d4", modPerLivello: 1 },
  },
  "Individuazione del Magico": {
    livello: 1, scuola: "Divinazione", tempo: "1 Azione", gittata: "Incantatore", componenti: "V, S", durata: "Fino a 10 minuti",
    concentrazione: true, rituale: true,
    descrizione: "Percepisci la presenza di magia entro 9 m. Con un'azione vedi l'aura di ciò che è magico e ne conosci la scuola. Bloccato da 30 cm di pietra, 2,5 cm di metallo comune, un sottile foglio di piombo o 90 cm di legno o terra.",
  },
  "Mani Brucianti": {
    livello: 1, scuola: "Invocazione", tempo: "1 Azione", gittata: "Incantatore (cono di 4,5 m)", componenti: "V, S", durata: "Istantanea",
    concentrazione: false, rituale: false,
    descrizione: "Un ventaglio di fiamme scaturisce dalle tue dita. Gli oggetti infiammabili non indossati né trasportati prendono fuoco.",
    livelloSuperiore: "+1d6 danni per ogni livello di slot sopra il 1°.",
    tiroSalvezza: { car: "DES", effetto: "metà danni" },
    danni: { dado: "3d6", tipo: "da fuoco", perLivello: "1d6" },
  },
  "Onda Tuonante": {
    livello: 1, scuola: "Invocazione", tempo: "1 Azione", gittata: "Incantatore (cubo di 4,5 m)", componenti: "V, S", durata: "Istantanea",
    concentrazione: false, rituale: false,
    descrizione: "Un'onda di forza tuonante: chi fallisce il TS subisce i danni e viene spinto di 3 m. Anche gli oggetti non fissati vengono spinti. Il boato si sente fino a 90 m.",
    livelloSuperiore: "+1d8 danni per ogni livello di slot sopra il 1°.",
    tiroSalvezza: { car: "COS", effetto: "metà danni e non viene spinto" },
    danni: { dado: "2d8", tipo: "da tuono", perLivello: "1d8" },
  },
  "Raggio di Infermità": {
    livello: 1, scuola: "Necromanzia", tempo: "1 Azione", gittata: "18 m", componenti: "V, S", durata: "Istantanea",
    concentrazione: false, rituale: false,
    descrizione: "Un raggio verdastro colpisce una creatura. Se colpita, deve superare un TS su COS o resta avvelenata fino alla fine del tuo prossimo turno.",
    livelloSuperiore: "+1d8 danni per ogni livello di slot sopra il 1°.",
    attacco: { numero: 1 },
    tiroSalvezza: { car: "COS", effetto: "non è avvelenata (i danni restano)" },
    danni: { dado: "2d8", tipo: "da veleno", perLivello: "1d8", perAttacco: true },
  },
  "Risata Incontenibile di Tasha": {
    livello: 1, scuola: "Ammaliamento", tempo: "1 Azione", gittata: "9 m", componenti: "V, S, M (una piccola torta e una piuma)", durata: "Fino a 1 minuto",
    concentrazione: true, rituale: false,
    descrizione: "Il bersaglio cade prono in preda alle risate: è incapacitato e non può rialzarsi. Le creature con INT 4 o meno non sono influenzate. Ripete il TS alla fine di ogni suo turno e quando subisce danni (con vantaggio).",
    tiroSalvezza: { car: "SAG", effetto: "nessun effetto" },
  },
  "Ritirata Rapida": {
    livello: 1, scuola: "Trasmutazione", tempo: "1 Azione Bonus", gittata: "Incantatore", componenti: "V, S", durata: "Fino a 10 minuti",
    concentrazione: true, rituale: false,
    descrizione: "Quando lanci l'incantesimo, e poi come azione bonus in ogni tuo turno finché dura, puoi eseguire l'azione di Scatto.",
  },
  "Scudo": {
    livello: 1, scuola: "Abiurazione", tempo: "1 Reazione", gittata: "Incantatore", componenti: "V, S", durata: "1 round",
    concentrazione: false, rituale: false,
    descrizione: "Quando vieni colpito da un attacco o bersagliato da Dardo Incantato: +5 alla CA fino all'inizio del tuo prossimo turno, anche contro l'attacco che l'ha innescato, e nessun danno da Dardo Incantato.",
  },
  "Blocca Persone": {
    livello: 2, scuola: "Ammaliamento", tempo: "1 Azione", gittata: "18 m", componenti: "V, S, M (un piccolo pezzo di ferro dritto)", durata: "Fino a 1 minuto",
    concentrazione: true, rituale: false,
    descrizione: "Un umanoide che vedi resta paralizzato. Ripete il TS alla fine di ogni suo turno e, se lo supera, l'effetto termina.",
    livelloSuperiore: "Un umanoide aggiuntivo per ogni livello di slot sopra il 2° (entro 9 m l'uno dall'altro).",
    tiroSalvezza: { car: "SAG", effetto: "nessun effetto" },
  },
  "Immagine Speculare": {
    livello: 2, scuola: "Illusione", tempo: "1 Azione", gittata: "Incantatore", componenti: "V, S", durata: "1 minuto",
    concentrazione: false, rituale: false,
    descrizione: "Compaiono tre duplicati illusori. Quando vieni attaccato, tira un d20 per vedere se l'attacco colpisce un duplicato: con 3 duplicati serve 6+, con 2 serve 8+, con 1 serve 11+. Un duplicato ha CA 10 + DES e svanisce se colpito.",
  },
  "Raggio Rovente": {
    livello: 2, scuola: "Invocazione", tempo: "1 Azione", gittata: "36 m", componenti: "V, S", durata: "Istantanea",
    concentrazione: false, rituale: false,
    descrizione: "Crei tre raggi di fuoco, ognuno con un proprio tiro per colpire, verso uno o più bersagli.",
    livelloSuperiore: "Un raggio in più per ogni livello di slot sopra il 2°.",
    attacco: { numero: 3, perLivello: 1 },
    danni: { dado: "2d6", tipo: "da fuoco", perAttacco: true },
  },
};

export const schedaDi = (nome: string): SchedaIncantesimo | undefined => SCHEDE_INCANTESIMI[nome];
