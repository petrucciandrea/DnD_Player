import type { Modalita } from "./regole.ts";
import type { DettagliIncantesimo } from "./tipi.ts";

// Contratto tra client e server: forme delle risposte dell'API che non sono già in tipi.ts.

export interface Utente {
  id: number;
  username: string;
}

export interface RiassuntoPersonaggio {
  id: number;
  nome: string;
  classe: string;
  sottoclasse: string;
  livello: number;
  razza: string;
  avatar?: string; // data URL; manca con un server di una versione precedente
  party?: { id: number; nome: string } | null; // party in cui gioca il personaggio
}

// Voce del catalogo condiviso degli incantesimi (GET /api/incantesimi).
export interface VoceIncantesimo {
  id: number;
  nome: string;
  livello: number;
  scuola: string;
  tempo: string;
  scheda?: DettagliIncantesimo;
}

// Party: un Master (senza personaggio) e i giocatori, ognuno con un personaggio.
export type RuoloParty = "master" | "giocatore";

// Voce di GET /api/party: i party dell'utente.
export interface RiassuntoParty {
  id: number;
  nome: string;
  ruolo: RuoloParty;
  personaggio: { id: number; nome: string } | null; // il personaggio con cui l'utente gioca (null per il Master)
  membri: number;
  nonLetti: number; // messaggi degli altri non ancora letti (gruppo e privati)
}

// Quello che i compagni vedono di un personaggio: niente scheda completa, solo lo stato in gioco.
export interface RiepilogoPersonaggioParty extends RiassuntoPersonaggio {
  pf: number;
  pfMassimi: number;
  pfTemporanei: number;
  ca: number;
  condizioni: string[]; // id delle condizioni (CONDIZIONI in dati/condizioni.ts)
  indebolimento: number;
}

export interface MembroParty {
  utenteId: number;
  username: string;
  ruolo: RuoloParty;
  personaggio: RiepilogoPersonaggioParty | null; // null per il Master
}

// GET /api/party/:id
export interface DettaglioParty {
  id: number;
  nome: string;
  codice: string | null; // solo per il Master, già nella forma XXXX-XXXX
  membri: MembroParty[];
  io: { utenteId: number; ruolo: RuoloParty; personaggioId: number | null };
}

// Tiro di dadi pubblicato nella chat del party.
export interface TiroCondiviso {
  titolo: string;
  descrizione?: string;
  dadi: { etichetta: string; facce: number }[];
  tiri: number[];
  modalita: Modalita;
  bonus: number;
  totale: number;
  presagio?: boolean; // il d20 è un dado del Presagio
}

export interface MessaggioParty {
  id: number;
  autoreId: number;
  autore: string; // nome del personaggio, "Master" o lo username di chi non è più nel party
  ruoloAutore: RuoloParty | null; // null: l'autore non è più nel party
  destinatarioId: number | null; // null: a tutto il gruppo
  tipo: "testo" | "tiro";
  testo: string;
  tiro: TiroCondiviso | null;
  creato: string; // ISO 8601
}

// GET /api/party/:id/messaggi. `letture`: fin dove l'utente ha letto ogni conversazione
// (chiave 0 = gruppo, altrimenti l'id dell'altro utente del privato).
export interface MessaggiParty {
  messaggi: MessaggioParty[];
  letture: Record<number, number>;
}
