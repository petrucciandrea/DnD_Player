import type {
  CategoriaDiario, Combattimento, DettaglioParty, MessaggiParty, Monete, OggettoTesoro, RiassuntoParty, Tesoro, TiroCondiviso, VoceDiario,
} from "@dnd/regole/api.ts";
import type { CharacterData } from "@dnd/regole/tipi.ts";
import { erroreDa, IRRAGGIUNGIBILE } from "./accesso";

// Chiamate all'API del party. Con 401 si torna all'accesso; con 404 il party non esiste più
// o l'utente non ne fa più parte; `stato` 0 vuol dire server non raggiungibile.

export type EsitoParty<T> = { dati: T } | { errore: string; stato: number; corpo?: unknown } | "sessione scaduta";

// Controlla l'esito di una chiamata: true se è andata; altrimenti chi la passa ha già gestito l'errore.
export type ControllaEsito = <T>(esito: EsitoParty<T>) => esito is { dati: T };

async function chiamata<T>(metodo: "GET" | "POST" | "PUT" | "DELETE", percorso: string, corpo?: unknown): Promise<EsitoParty<T>> {
  try {
    const res = await fetch(`/api/party${percorso}`, {
      method: metodo,
      cache: "no-store",
      ...(corpo === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) }),
    });
    if (res.status === 401) return "sessione scaduta";
    const risposta: unknown = res.status === 204 ? null : await res.json().catch(() => null);
    return res.ok
      ? { dati: risposta as T }
      : { errore: erroreDa(risposta, "Operazione non riuscita: riprova."), stato: res.status, corpo: risposta };
  } catch {
    return { errore: IRRAGGIUNGIBILE, stato: 0 };
  }
}

export const elencoParty = () => chiamata<RiassuntoParty[]>("GET", "");
export const creaParty = (nome: string) => chiamata<{ id: number; codice: string }>("POST", "", { nome });
export const entraNelParty = (codice: string, personaggioId: number) =>
  chiamata<{ id: number }>("POST", "/entra", { codice, personaggioId });
export const dettaglioParty = (id: number) => chiamata<DettaglioParty>("GET", `/${id}`);
export const rinominaParty = (id: number, nome: string) => chiamata<null>("PUT", `/${id}`, { nome });
export const rigeneraCodice = (id: number) => chiamata<{ codice: string }>("POST", `/${id}/codice`);
export const sciogliParty = (id: number) => chiamata<null>("DELETE", `/${id}`);
export const togliMembro = (id: number, utenteId: number) => chiamata<null>("DELETE", `/${id}/membri/${utenteId}`);
export const schedaNelParty = (id: number, personaggioId: number) =>
  chiamata<CharacterData>("GET", `/${id}/personaggi/${personaggioId}`);

export const leggiMessaggi = (id: number, cursore: { dopo?: number; prima?: number } = {}) => {
  const query = cursore.dopo !== undefined ? `?dopo=${cursore.dopo}` : cursore.prima !== undefined ? `?prima=${cursore.prima}` : "";
  return chiamata<MessaggiParty>("GET", `/${id}/messaggi${query}`);
};
export const inviaMessaggio = (id: number, testo: string, destinatarioId: number | null) =>
  chiamata<{ id: number }>("POST", `/${id}/messaggi`, { testo, ...(destinatarioId !== null ? { destinatarioId } : {}) });
export const segnaLetto = (id: number, con: number, fino: number) => chiamata<null>("PUT", `/${id}/letto`, { con, fino });
export const inviaTiro = (id: number, tiro: TiroCondiviso, segreto: boolean) =>
  chiamata<{ id: number }>("POST", `/${id}/messaggi`, { tiro, segreto });

export interface DatiVoce {
  titolo: string;
  testo: string;
  categoria: CategoriaDiario;
  fissata?: boolean;
}

export const vociDiario = (id: number) => chiamata<VoceDiario[]>("GET", `/${id}/diario`);
export const creaVoce = (id: number, voce: DatiVoce) => chiamata<VoceDiario>("POST", `/${id}/diario`, voce);
// Con 409 `corpo` è la versione attuale della voce, cambiata da un altro nel frattempo.
export const modificaVoce = (id: number, voceId: number, voce: DatiVoce, revisione: number) =>
  chiamata<VoceDiario>("PUT", `/${id}/diario/${voceId}`, { ...voce, revisione });
export const cancellaVoce = (id: number, voceId: number) => chiamata<null>("DELETE", `/${id}/diario/${voceId}`);

export interface DatiVoceIniziativa {
  nome?: string;
  valore?: number;
  bonus?: number;
  nascosto?: boolean;
}

export const leggiCombattimento = (id: number) => chiamata<Combattimento>("GET", `/${id}/combattimento`);
export const avviaCombattimento = (id: number) => chiamata<null>("POST", `/${id}/combattimento`);
export const terminaCombattimento = (id: number) => chiamata<null>("DELETE", `/${id}/combattimento`);
export const avanzaTurno = (id: number, direzione: 1 | -1) => chiamata<null>("POST", `/${id}/combattimento/avanza`, { direzione });
export const mandaIniziativa = (id: number, valore: number) => chiamata<null>("PUT", `/${id}/combattimento/mio`, { valore });
export const aggiungiVoceIniziativa = (id: number, voce: DatiVoceIniziativa) =>
  chiamata<{ id: number }>("POST", `/${id}/combattimento/voci`, voce);
export const modificaVoceIniziativa = (id: number, voceId: number, voce: DatiVoceIniziativa) =>
  chiamata<null>("PUT", `/${id}/combattimento/voci/${voceId}`, voce);
export const togliVoceIniziativa = (id: number, voceId: number) => chiamata<null>("DELETE", `/${id}/combattimento/voci/${voceId}`);

export const leggiTesoro = (id: number) => chiamata<Tesoro>("GET", `/${id}/tesoro`);
// Positivi si mettono, negativi si prendono; 409 se nel tesoro non bastano.
export const cambiaMoneteTesoro = (id: number, delta: Partial<Monete>) => chiamata<Monete>("POST", `/${id}/tesoro/monete`, { delta });
export const mettiNelTesoro = (id: number, oggetto: Omit<OggettoTesoro, "id">) => chiamata<{ id: number }>("POST", `/${id}/tesoro/oggetti`, oggetto);
export const prendiDalTesoro = (id: number, oggettoId: number, qta: number) =>
  chiamata<Omit<OggettoTesoro, "id">>("POST", `/${id}/tesoro/oggetti/${oggettoId}/prendi`, { qta });
export const togliDalTesoro = (id: number, oggettoId: number) => chiamata<null>("DELETE", `/${id}/tesoro/oggetti/${oggettoId}`);
