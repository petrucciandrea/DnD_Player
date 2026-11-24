import type { DettaglioParty, MessaggiParty, RiassuntoParty, TiroCondiviso } from "@dnd/regole/api.ts";
import type { CharacterData } from "@dnd/regole/tipi.ts";
import { erroreDa, IRRAGGIUNGIBILE } from "./accesso";

// Chiamate all'API del party. Con 401 si torna all'accesso; con 404 il party non esiste più
// o l'utente non ne fa più parte; `stato` 0 vuol dire server non raggiungibile.

export type EsitoParty<T> = { dati: T } | { errore: string; stato: number } | "sessione scaduta";

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
    return res.ok ? { dati: risposta as T } : { errore: erroreDa(risposta, "Operazione non riuscita: riprova."), stato: res.status };
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
