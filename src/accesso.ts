import type { CatalogoCreazione, CharacterData, DettagliIncantesimo, PrivilegioClasse } from "./tipi";

// Chiamate all'API del server locale (server/api.ts) per accesso, personaggi e catalogo.
// La sessione è un cookie HttpOnly: la pagina non vede il token, sa solo chi ha fatto l'accesso.

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
}

// Voce del catalogo condiviso degli incantesimi.
export interface VoceIncantesimo {
  id: number;
  nome: string;
  livello: number;
  scuola: string;
  tempo: string;
  scheda?: DettagliIncantesimo;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

const utenteDa = (v: unknown): Utente | null =>
  isObj(v) && typeof v.id === "number" && typeof v.username === "string" ? { id: v.id, username: v.username } : null;

const erroreDa = (corpo: unknown, predefinito: string) =>
  isObj(corpo) && typeof corpo.errore === "string" ? corpo.errore : predefinito;

const IRRAGGIUNGIBILE = "Archivio non raggiungibile: controlla che il server sia avviato.";

// null se non c'è una sessione valida, "offline" se il server non risponde.
export async function sessioneAttuale(): Promise<Utente | null | "offline"> {
  try {
    const res = await fetch("/api/sessione", { cache: "no-store" });
    if (res.status === 401) return null;
    return res.ok ? utenteDa(await res.json()) ?? "offline" : "offline";
  } catch {
    return "offline";
  }
}

async function inviaCredenziali(
  percorso: "/api/accesso" | "/api/registrazione", username: string, password: string,
): Promise<{ utente: Utente } | { errore: string }> {
  try {
    const res = await fetch(percorso, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const corpo: unknown = await res.json().catch(() => null);
    const utente = res.ok ? utenteDa(corpo) : null;
    if (utente) return { utente };
    if (percorso === "/api/accesso" && res.status === 401) return { errore: "Username o password non corretti." };
    return { errore: erroreDa(corpo, "Operazione non riuscita: riprova.") };
  } catch {
    return { errore: IRRAGGIUNGIBILE };
  }
}

export const accedi = (username: string, password: string) => inviaCredenziali("/api/accesso", username, password);
export const registra = (username: string, password: string) => inviaCredenziali("/api/registrazione", username, password);

export async function esci() {
  try {
    await fetch("/api/uscita", { method: "POST" });
  } catch {
    // Se il server non risponde la sessione scadrà da sola: si torna comunque alla schermata di accesso.
  }
}

// Modifiche dell'account: entrambe chiedono la password attuale.
// "sessione scaduta" se il server risponde 401; errori di validazione e password sbagliata in `errore`.
type EsitoAccount<T> = T | { errore: string } | "sessione scaduta";

async function modificaAccount(percorso: string, corpo: unknown): Promise<EsitoAccount<{ risposta: unknown }>> {
  try {
    const res = await fetch(percorso, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    if (res.status === 401) return "sessione scaduta";
    const risposta: unknown = await res.json().catch(() => null);
    return res.ok ? { risposta } : { errore: erroreDa(risposta, "Modifica non riuscita: riprova.") };
  } catch {
    return { errore: IRRAGGIUNGIBILE };
  }
}

export async function cambiaUsername(username: string, password: string): Promise<EsitoAccount<{ utente: Utente }>> {
  const esito = await modificaAccount("/api/account/username", { username, password });
  if (esito === "sessione scaduta" || "errore" in esito) return esito;
  const utente = utenteDa(esito.risposta);
  return utente ? { utente } : { errore: "Modifica non riuscita: riprova." };
}

// Dopo il cambio gli altri dispositivi devono rifare l'accesso; questo resta collegato.
export async function cambiaPassword(attuale: string, nuova: string): Promise<EsitoAccount<{ ok: true }>> {
  const esito = await modificaAccount("/api/account/password", { attuale, nuova });
  return esito === "sessione scaduta" || "errore" in esito ? esito : { ok: true };
}

// "sessione scaduta" se il server risponde 401.
export async function elencoPersonaggi(): Promise<RiassuntoPersonaggio[] | "sessione scaduta" | "offline"> {
  try {
    const res = await fetch("/api/personaggi", { cache: "no-store" });
    if (res.status === 401) return "sessione scaduta";
    const corpo: unknown = res.ok ? await res.json() : null;
    return Array.isArray(corpo) ? (corpo as RiassuntoPersonaggio[]) : "offline";
  } catch {
    return "offline";
  }
}

// Crea un personaggio nell'archivio a partire da una scheda (già validata con daJSON).
export async function importaPersonaggio(dati: CharacterData): Promise<{ id: number } | { errore: string }> {
  try {
    const res = await fetch("/api/personaggi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dati }),
    });
    const corpo: unknown = await res.json().catch(() => null);
    if (res.ok && isObj(corpo) && typeof corpo.id === "number") return { id: corpo.id };
    return { errore: erroreDa(corpo, "Importazione non riuscita.") };
  } catch {
    return { errore: IRRAGGIUNGIBILE };
  }
}

// Cataloghi per la procedura di creazione; null se non sono raggiungibili.
export async function catalogoCreazione(): Promise<CatalogoCreazione | null> {
  try {
    const res = await fetch("/api/creazione");
    return res.ok ? ((await res.json()) as CatalogoCreazione) : null;
  } catch {
    return null;
  }
}

// Privilegi di classe (e di sottoclasse) di un livello; null se il catalogo non è raggiungibile.
export async function privilegiDiLivello(classe: string, livello: number, sottoclasse: string): Promise<PrivilegioClasse[] | null> {
  try {
    const parametri = new URLSearchParams({ livello: String(livello), sottoclasse });
    const res = await fetch(`/api/classi/${encodeURIComponent(classe)}/privilegi?${parametri}`);
    const corpo: unknown = res.ok ? await res.json() : null;
    return Array.isArray(corpo) ? (corpo as PrivilegioClasse[]) : null;
  } catch {
    return null;
  }
}

// Tutti i privilegi di classe (e di sottoclasse) fino a un livello; null se il catalogo non è raggiungibile.
export async function privilegiFinoAlLivello(classe: string, livello: number, sottoclasse: string): Promise<PrivilegioClasse[] | null> {
  try {
    const parametri = new URLSearchParams({ fino: String(livello), sottoclasse });
    const res = await fetch(`/api/classi/${encodeURIComponent(classe)}/privilegi?${parametri}`);
    const corpo: unknown = res.ok ? await res.json() : null;
    return Array.isArray(corpo) ? (corpo as PrivilegioClasse[]) : null;
  } catch {
    return null;
  }
}

// Catalogo condiviso degli incantesimi; null se non è raggiungibile.
export async function catalogoIncantesimi(): Promise<VoceIncantesimo[] | null> {
  try {
    const res = await fetch("/api/incantesimi");
    const corpo: unknown = res.ok ? await res.json() : null;
    return Array.isArray(corpo) ? (corpo as VoceIncantesimo[]) : null;
  } catch {
    return null;
  }
}
