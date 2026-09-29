import type { Dispatch, SetStateAction } from "react";

// --- INTERFACCE TYPESCRIPT ---
export type Caratteristica = "FOR" | "DES" | "COS" | "INT" | "SAG" | "CAR";

export interface AbilityScore {
  valore: number;
  compTS: boolean;
}

export interface Spell {
  id: number;
  nome: string;
  livello: number;
  scuola: string;
  tempo: string;
  preparato: boolean;
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
  };
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
