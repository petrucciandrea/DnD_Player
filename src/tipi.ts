import type { Dispatch, SetStateAction } from "react";

// --- INTERFACCE TYPESCRIPT ---
export type Caratteristica = "FOR" | "DES" | "COS" | "INT" | "SAG" | "CAR";

export interface AbilityScore {
  valore: number;
  compTS: boolean;
}

// Dettagli di un incantesimo del catalogo (tabella `incantesimi` dell'archivio).
export interface DettagliIncantesimo {
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

// Voce completa del catalogo, come nel seed del server.
export interface SchedaIncantesimo extends DettagliIncantesimo {
  livello: number;
  scuola: string;
  tempo: string;
}

// Incantesimo nel grimorio del personaggio. `id` è quello del catalogo (o provvisorio, per una voce
// appena aggiunta); `scheda` arriva dal catalogo e manca per gli incantesimi senza dettagli.
export interface Spell {
  id: number;
  nome: string;
  livello: number;
  scuola: string;
  tempo: string;
  preparato: boolean;
  scheda?: DettagliIncantesimo;
}

export interface InventoryItem {
  id: number;
  nome: string;
  qta: number;
  peso: number; // lb per unità
}

export interface XPRecord {
  id: number;
  data: string;
  valore: number;
  motivo: string;
}

export interface Arma {
  nome: string;
  dado: string;
  dadoVersatile?: string;
  tipoDanno: string;
  proprieta: string;
  accurata: boolean;
}

export interface Privilegio {
  nome: string;
  fonte: string;
  descrizione: string;
}

// Solo i dati "grezzi": tutto ciò che si può calcolare (modificatori, TS, CA,
// bonus competenza, slot massimi...) sta in regole.ts.
export interface CharacterData {
  versione: 2;
  info: {
    nome: string;
    classe: string;
    sottoclasse: string;
    livello: number;
    razza: string;
    background: string;
    allineamento: string;
    giocatore: string;
    eta: number;
    altezza: string;
    peso: string;
    occhi: string;
    capelli: string;
    carnagione: string;
    velocita: string;
    ispirazione: boolean;
  };
  caratteristiche: Record<Caratteristica, AbilityScore>;
  competenzeAbilita: string[];
  combattimento: {
    pfAttuali: number;
    pfMassimi: number;
    pfTemporanei: number;
    dadiVitaRimanenti: number;
    tsMorte: { successi: number; fallimenti: number };
    stabile: boolean; // a 0 PF ma stabilizzato
  };
  concentrazione: string | null; // nome dell'incantesimo su cui si mantiene la concentrazione
  divinazione: {
    presagio: number[];
    usati: boolean[];
  };
  recuperoArcanoUsato: boolean;
  monete: {
    mr: number;
    ma: number;
    me: number;
    mo: number;
    mp: number;
  };
  xp: {
    totale: number;
    storico: XPRecord[];
  };
  armi: Arma[];
  slotSpesi: number[]; // indice 0 = slot di 1° livello, lunghezza 9
  incantesimi: Spell[];
  inventario: InventoryItem[];
  privilegi: Privilegio[];
  lore: {
    tratti: string;
    ideali: string;
    legami: string;
    difetti: string;
    backgroundBio: string;
  };
}

export interface EsitoRiposoBreve {
  dadiVitaSpesi: number;
  pfRecuperati: number;
  slotRecuperati: number[]; // indice 0 = slot di 1° livello (Recupero Arcano)
}

export type SetChar =Dispatch<SetStateAction<CharacterData>>;
