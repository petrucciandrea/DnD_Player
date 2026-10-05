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
  categoria?: "semplice" | "guerra";
  distanza?: boolean; // arma a distanza: si attacca con DES
}

// Un contatore con un massimo (munizioni, durabilità).
export interface Contatore {
  rimasti: number;
  massimo: number;
}

// Arma posseduta dal personaggio: i dati dell'arma vengono dal catalogo, il resto è di questa copia.
export interface ArmaPersonaggio extends Arma {
  id: number;
  bonus: number; // arma magica +1/+2/+3: si somma ad attacco e danni
  munizioni: Contatore | null; // frecce, dardi, armi da lancio, cariche (null = non si contano)
  durabilita: Contatore | null; // usi prima di rompersi (null = non si consuma)
  danneggiata: number | null; // arma senza durabilità danneggiata: colpi che regge ancora prima di rompersi
  rotta: boolean;
}

// Armatura del catalogo (tabella `armature`). Lo scudo è a parte (+2 alla CA).
export interface Armatura {
  nome: string;
  categoria: "leggera" | "media" | "pesante";
  ca: number; // CA base
  maxDes: number | null; // bonus massimo di DES (null = nessun limite, 0 = niente DES)
  forzaMin: number; // 0 = nessun requisito
  svantaggioFurtivita: boolean;
  peso: number; // lb
}

// Competenze che non sono abilità né tiri salvezza.
export interface CompetenzeAltre {
  lingue: string[];
  strumenti: string[];
  armi: string[];
  armature: string[];
}

export interface Privilegio {
  nome: string;
  fonte: string;
  descrizione: string;
}

// Effetto attivo (incantesimo o privilegio con una durata), definito in dati/condizioni.ts.
export interface EffettoAttivo {
  id: string;
  valore?: number; // per gli effetti con un contatore (duplicati di Immagine Speculare)
}

export type CategoriaNota = "sessione" | "png" | "obiettivo" | "altro";

// Nota di sessione: appunti, personaggi incontrati, obiettivi (con `fatto`).
export interface NotaSessione {
  id: number;
  data: string;
  categoria: CategoriaNota;
  titolo: string;
  testo: string;
  fatto: boolean;
  campi: Record<string, string>; // campi della categoria (dati/note.ts): razza e classe di un PNG...
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
    taglia: string; // "Piccola", "Media"...
    ispirazione: boolean;
    avatar: string; // data URL dell'immagine (JPEG ridotto), "" = nessuna
  };
  caratteristiche: Record<Caratteristica, AbilityScore>;
  competenzeAbilita: string[];
  competenzeAltre: CompetenzeAltre;
  armatura: Armatura | null; // armatura indossata (dal catalogo)
  scudo: boolean;
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
  risorseUsate: Record<string, number>; // usi spesi per id di risorsa (dati/risorse.ts)
  condizioni: string[]; // id delle condizioni attive (dati/condizioni.ts)
  indebolimento: number; // livello da 0 a 6
  effetti: EffettoAttivo[];
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
  armi: ArmaPersonaggio[];
  slotSpesi: number[]; // indice 0 = slot di 1° livello, lunghezza 9
  incantesimi: Spell[];
  inventario: InventoryItem[];
  privilegi: Privilegio[];
  note: NotaSessione[];
  lore: {
    tratti: string;
    ideali: string;
    legami: string;
    difetti: string;
    backgroundBio: string;
  };
}

// --- Cataloghi per la creazione del personaggio (GET /api/creazione) ---

export interface RazzaCatalogo {
  nome: string;
  madre: string | null; // sottorazza: si somma alla razza madre
  taglia: string | null;
  velocita: string | null;
  bonus: Partial<Record<Caratteristica, number>>;
  bonusAScelta: number;
  abilita: string[]; // id di ABILITA
  abilitaAScelta: number;
  lingue: string[];
  lingueAScelta: number;
  armi: string[];
  armature: string[];
  strumentiAScelta: string[];
  trucchetto: string | null; // "*" = uno a scelta dalla lista del mago
  privilegi: Privilegio[];
}

export interface BackgroundCatalogo {
  nome: string;
  abilita: string[];
  strumenti: string[];
  strumentiAScelta: "artigiano" | "musicale" | "gioco" | null;
  lingueAScelta: number;
  equipaggiamento: Omit<InventoryItem, "id">[];
  mo: number;
  privilegio: Privilegio;
}

export interface PrivilegioClasse {
  classe: string;
  sottoclasse: string | null;
  livello: number;
  privilegio: Privilegio;
}

export interface IncantesimoCatalogo {
  id: number;
  nome: string;
  livello: number;
  scuola: string;
  tempo: string;
  scheda?: DettagliIncantesimo;
  classi: string[];
}

export interface CatalogoCreazione {
  razze: RazzaCatalogo[];
  background: BackgroundCatalogo[];
  armi: Arma[];
  armature: Armatura[];
  privilegiClasse: PrivilegioClasse[]; // 1° livello
  opzioniPrivilegio: Privilegio[]; // opzioni delle scelte di privilegio (Metamagia, stili, terreni: dati/scelte.ts)
  incantesimi: IncantesimoCatalogo[];
}

export interface EsitoRiposoBreve {
  dadiVitaSpesi: number;
  pfRecuperati: number;
  slotRecuperati: number[]; // indice 0 = slot di 1° livello (Recupero Arcano)
}

export type SetChar =Dispatch<SetStateAction<CharacterData>>;
