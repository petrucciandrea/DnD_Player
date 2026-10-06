import type { CharacterData } from "@dnd/regole/tipi.ts";
import { daJSON } from "@dnd/regole/scheda.ts";

// Copia locale di ogni personaggio, indicata dal suo id nell'archivio.
const chiaveScheda = (personaggio: number) => `dnd_personaggio_${personaggio}`;
const chiaveRiferimento = (personaggio: number) => `dnd_personaggio_${personaggio}_sincronizzazione`;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

// null se questo browser non ha ancora una copia del personaggio.
export function carica(personaggio: number): CharacterData | null {
  try {
    const raw = localStorage.getItem(chiaveScheda(personaggio));
    if (raw) return daJSON(JSON.parse(raw));
  } catch (e) {
    console.error("Copia locale non leggibile", e);
  }
  return null;
}

export function salva(personaggio: number, c: CharacterData) {
  try {
    localStorage.setItem(chiaveScheda(personaggio), JSON.stringify(c));
  } catch (e) {
    console.error("Impossibile salvare la scheda", e);
  }
}

// Ultimo personaggio aperto dall'utente su questo browser: si riapre da solo dopo l'accesso,
// purché ce ne sia una copia locale.
const chiaveUltimo = (utenteId: number) => `dnd_utente_${utenteId}_ultimo_personaggio`;

export function ultimoPersonaggio(utenteId: number): number | null {
  try {
    const id = Number(localStorage.getItem(chiaveUltimo(utenteId)));
    return Number.isInteger(id) && id > 0 && localStorage.getItem(chiaveScheda(id)) ? id : null;
  } catch {
    return null;
  }
}

export function ricordaUltimoPersonaggio(utenteId: number, personaggio: number | null) {
  try {
    if (personaggio === null) localStorage.removeItem(chiaveUltimo(utenteId));
    else localStorage.setItem(chiaveUltimo(utenteId), String(personaggio));
  } catch {
    // Solo una comodità: se il browser non salva, si sceglie di nuovo il personaggio.
  }
}

// --- Archivio SQLite sul server locale (server/api.ts) ---

const urlPersonaggio = (personaggio: number) => `/api/personaggi/${personaggio}`;

// Revisione del server su cui si basa la scheda locale, e se ci sono modifiche non ancora inviate.
// Sta nel localStorage perché le modifiche fatte appena prima di chiudere la pagina non vadano perse.
export interface RiferimentoServer {
  revisione: number;
  inSospeso: boolean;
}

export function caricaRiferimento(personaggio: number): RiferimentoServer {
  try {
    const r: unknown = JSON.parse(localStorage.getItem(chiaveRiferimento(personaggio)) ?? "null");
    if (isObj(r) && typeof r.revisione === "number") return { revisione: r.revisione, inSospeso: r.inSospeso === true };
  } catch {
    // Nessun riferimento valido: si riparte come se il server non fosse mai stato contattato.
  }
  return { revisione: 0, inSospeso: false };
}

export function salvaRiferimento(personaggio: number, r: RiferimentoServer) {
  try {
    localStorage.setItem(chiaveRiferimento(personaggio), JSON.stringify(r));
  } catch (e) {
    console.error("Impossibile salvare lo stato della sincronizzazione", e);
  }
}

export interface VersioneServer {
  dati: CharacterData;
  revisione: number;
}

// "sessione scaduta": il server ha risposto 401, bisogna rifare l'accesso.
// "inesistente": il personaggio non c'è più o non è dell'utente collegato (404).
type Irraggiungibile = { tipo: "offline" } | { tipo: "sessione scaduta" } | { tipo: "inesistente" };
export type EsitoDownload = { tipo: "trovato"; versione: VersioneServer } | Irraggiungibile;
export type EsitoInvio =
  | { tipo: "ok"; revisione: number }
  | { tipo: "conflitto"; attuale: VersioneServer | null }
  | Irraggiungibile;

export const versioneDa = (v: unknown): VersioneServer | null => {
  if (!isObj(v) || typeof v.revisione !== "number") return null;
  try {
    return { dati: daJSON(v.dati), revisione: v.revisione };
  } catch (e) {
    console.error("Scheda sul server non valida", e);
    return null;
  }
};

const esitoErrore = (stato: number): Irraggiungibile =>
  stato === 401 ? { tipo: "sessione scaduta" } : stato === 404 ? { tipo: "inesistente" } : { tipo: "offline" };

export async function scaricaDalServer(personaggio: number): Promise<EsitoDownload> {
  try {
    const res = await fetch(urlPersonaggio(personaggio), { cache: "no-store" });
    if (!res.ok) return esitoErrore(res.status);
    const versione = versioneDa(await res.json());
    return versione ? { tipo: "trovato", versione } : { tipo: "offline" };
  } catch {
    return { tipo: "offline" };
  }
}

// `revisione` è quella su cui si basano le modifiche.
export async function inviaAlServer(personaggio: number, dati: CharacterData, revisione: number): Promise<EsitoInvio> {
  try {
    const res = await fetch(urlPersonaggio(personaggio), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dati, revisione }),
    });
    if (res.status === 409) return { tipo: "conflitto", attuale: versioneDa(await res.json()) };
    if (!res.ok) return esitoErrore(res.status);
    const corpo: unknown = await res.json();
    return isObj(corpo) && typeof corpo.revisione === "number" ? { tipo: "ok", revisione: corpo.revisione } : { tipo: "offline" };
  } catch {
    return { tipo: "offline" };
  }
}
