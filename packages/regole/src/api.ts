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
