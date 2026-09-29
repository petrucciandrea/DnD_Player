import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";
import type { Connect, Plugin } from "vite";
import type { CharacterData } from "../src/tipi.ts";
import { completaConEsistente, daJSON } from "../src/scheda.ts";
import {
  apriSessione, cambiaPassword, cambiaUsername, chiudiSessione, creaUtente, DURATA_SESSIONE, errorePassword,
  erroreRegistrazione, erroreUsername, leggiSessione, passwordDiUtente, verificaCredenziali,
} from "./accesso.ts";
import { apriArchivio, leggi, scrivi } from "./archivio.ts";
import { catalogoCreazione, elencoIncantesimi, privilegiDiClasse } from "./catalogo.ts";
import { creaPersonaggio, elencoPersonaggi } from "./personaggi.ts";

// DND_ARCHIVIO permette di usare un altro file, per esempio per le prove.
export const PERCORSO_ARCHIVIO = resolve(process.env.DND_ARCHIVIO ?? "archivio/dnd_player.sqlite");
const COOKIE = "dnd_sessione";
const ATTESA_ERRORE_ACCESSO = 1000; // ms: rallenta i tentativi di indovinare la password
const DIMENSIONE_MASSIMA_CORPO = 2 * 1024 * 1024; // byte

class ErroreRichiesta extends Error {
  readonly stato: number;
  constructor(stato: number, messaggio: string) {
    super(messaggio);
    this.stato = stato;
  }
}

const rispondi = (res: ServerResponse, stato: number, corpo?: unknown) => {
  res.statusCode = stato;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(corpo === undefined ? "" : JSON.stringify(corpo));
};

async function leggiCorpo(req: IncomingMessage): Promise<Record<string, unknown>> {
  const parti: Buffer[] = [];
  let dimensione = 0;
  for await (const parte of req) {
    dimensione += (parte as Buffer).length;
    if (dimensione > DIMENSIONE_MASSIMA_CORPO) throw new ErroreRichiesta(413, "Richiesta troppo grande");
    parti.push(parte as Buffer);
  }
  let corpo: unknown;
  try {
    corpo = JSON.parse(Buffer.concat(parti).toString("utf8"));
  } catch {
    throw new ErroreRichiesta(400, "JSON non valido");
  }
  if (typeof corpo !== "object" || corpo === null || Array.isArray(corpo)) throw new ErroreRichiesta(400, "JSON non valido");
  return corpo as Record<string, unknown>;
}

// La scheda arriva dal client: la si valida e normalizza come per un import.
function schedaDa(dati: unknown): CharacterData {
  try {
    return daJSON(dati);
  } catch {
    throw new ErroreRichiesta(400, "Scheda personaggio non valida");
  }
}

const credenzialiDa = (corpo: Record<string, unknown>) => {
  const { username, password } = corpo;
  if (typeof username !== "string" || typeof password !== "string") throw new ErroreRichiesta(400, "Servono username e password");
  return { username, password };
};

const tokenDa = (req: IncomingMessage): string | null => {
  for (const coppia of (req.headers.cookie ?? "").split(";")) {
    const [nome, ...valore] = coppia.trim().split("=");
    if (nome === COOKIE) return decodeURIComponent(valore.join("="));
  }
  return null;
};

// HttpOnly: il token non è leggibile dal JavaScript della pagina. SameSite=Strict: nessuna richiesta da altri siti.
const impostaCookie = (res: ServerResponse, token: string, durata: number) =>
  res.setHeader("Set-Cookie", `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(durata / 1000)}`);

// API montata sia nel server di sviluppo sia in quello di anteprima (tutte sotto /api):
//   POST /registrazione { username, password } → { id, username } e cookie di sessione; 400 o 409 se non valida
//   POST /accesso { username, password }       → { id, username } e cookie di sessione, oppure 401
//   POST /uscita                               → chiude la sessione
// Le altre richiedono una sessione valida (altrimenti 401):
//   GET  /sessione                             → { id, username }
//   PUT  /account/username { username, password } → { id, username }; 403 se la password è sbagliata, 400, 409
//   PUT  /account/password { attuale, nuova }  → 204 e chiude le sessioni degli altri dispositivi; 403, 400
//   GET  /personaggi                           → personaggi dell'utente (riassunto)
//   POST /personaggi { dati }                  → crea un personaggio dalla scheda → { id }
//   GET  /personaggi/:id                       → { dati, revisione }; 404 se non è dell'utente
//   PUT  /personaggi/:id { dati, revisione }   → { revisione }, 409 con la versione attuale, 404 se non è dell'utente
//   GET  /incantesimi                          → catalogo degli incantesimi
//   GET  /creazione                            → cataloghi per creare un personaggio (razze, background, armi...)
//   GET  /classi/:classe/privilegi?livello=n&sottoclasse=… → privilegi di classe di quel livello
export function apiPersonaggio(): Plugin {
  let db: ReturnType<typeof apriArchivio> | null = null;
  const archivio = () => (db ??= apriArchivio(PERCORSO_ARCHIVIO));

  async function gestisci(req: IncomingMessage, res: ServerResponse, percorso: string) {
    const metodo = req.method ?? "GET";

    if (percorso === "/registrazione" && metodo === "POST") {
      const { username, password } = credenzialiDa(await leggiCorpo(req));
      const errore = erroreRegistrazione(username, password);
      if (errore) return rispondi(res, 400, { errore });
      const utente = creaUtente(archivio(), username, password);
      if (!utente) return rispondi(res, 409, { errore: "Questo username è già in uso." });
      impostaCookie(res, apriSessione(archivio(), utente.id), DURATA_SESSIONE);
      return rispondi(res, 201, utente);
    }

    if (percorso === "/accesso" && metodo === "POST") {
      const { username, password } = credenzialiDa(await leggiCorpo(req));
      const utente = verificaCredenziali(archivio(), username, password);
      if (!utente) {
        await new Promise(r => setTimeout(r, ATTESA_ERRORE_ACCESSO));
        return rispondi(res, 401, { errore: "Username o password non corretti" });
      }
      impostaCookie(res, apriSessione(archivio(), utente.id), DURATA_SESSIONE);
      return rispondi(res, 200, utente);
    }

    const token = tokenDa(req);
    const utente = token ? leggiSessione(archivio(), token) : null;

    if (percorso === "/uscita" && metodo === "POST") {
      if (token) chiudiSessione(archivio(), token);
      impostaCookie(res, "", 0);
      return rispondi(res, 204);
    }
    if (!utente) return rispondi(res, 401, { errore: "Accesso richiesto" });

    if (percorso === "/sessione" && metodo === "GET") return rispondi(res, 200, utente);

    // Per cambiare username o password serve la password attuale. 403 e non 401:
    // per il client 401 significa "sessione scaduta".
    const passwordSbagliata = async () => {
      await new Promise(r => setTimeout(r, ATTESA_ERRORE_ACCESSO));
      rispondi(res, 403, { errore: "La password attuale non è corretta." });
    };
    if (percorso === "/account/username" && metodo === "PUT") {
      const { username, password } = credenzialiDa(await leggiCorpo(req));
      if (!passwordDiUtente(archivio(), utente.id, password)) return passwordSbagliata();
      const errore = erroreUsername(username);
      if (errore) return rispondi(res, 400, { errore });
      const aggiornato = cambiaUsername(archivio(), utente.id, username);
      return aggiornato ? rispondi(res, 200, aggiornato) : rispondi(res, 409, { errore: "Questo username è già in uso." });
    }
    if (percorso === "/account/password" && metodo === "PUT") {
      const { attuale, nuova } = await leggiCorpo(req);
      if (typeof attuale !== "string" || typeof nuova !== "string") throw new ErroreRichiesta(400, "Servono la password attuale e quella nuova");
      if (!passwordDiUtente(archivio(), utente.id, attuale)) return passwordSbagliata();
      const errore = errorePassword(nuova);
      if (errore) return rispondi(res, 400, { errore });
      cambiaPassword(archivio(), utente.id, nuova, token!);
      return rispondi(res, 204);
    }

    if (percorso === "/incantesimi" && metodo === "GET") return rispondi(res, 200, elencoIncantesimi(archivio()));
    if (percorso === "/creazione" && metodo === "GET") return rispondi(res, 200, catalogoCreazione(archivio()));

    const classe = /^\/classi\/([^/]+)\/privilegi$/.exec(percorso);
    if (classe && metodo === "GET") {
      const parametri = new URL(req.url ?? "", "http://x").searchParams;
      const livello = Number(parametri.get("livello"));
      if (!Number.isInteger(livello) || livello < 1 || livello > 20) return rispondi(res, 400, { errore: "Livello non valido" });
      return rispondi(res, 200, privilegiDiClasse(archivio(), {
        classe: decodeURIComponent(classe[1]), livello, sottoclasse: parametri.get("sottoclasse") ?? "",
      }));
    }

    if (percorso === "/personaggi" && metodo === "GET") return rispondi(res, 200, elencoPersonaggi(archivio(), utente.id));
    if (percorso === "/personaggi" && metodo === "POST") {
      const scheda = schedaDa((await leggiCorpo(req)).dati);
      return rispondi(res, 201, { id: creaPersonaggio(archivio(), utente.id, scheda) });
    }

    const personaggio = /^\/personaggi\/(\d+)$/.exec(percorso);
    if (personaggio) {
      const id = Number(personaggio[1]);
      if (metodo === "GET") {
        const versione = leggi(archivio(), id, utente.id);
        return versione ? rispondi(res, 200, versione) : rispondi(res, 404, { errore: "Personaggio inesistente" });
      }
      if (metodo === "PUT") {
        const corpo = await leggiCorpo(req);
        if (typeof corpo.revisione !== "number") return rispondi(res, 400, { errore: "Servono dati e revisione" });
        // I campi che il client non invia (versione vecchia dell'app) restano quelli salvati.
        const esistente = leggi(archivio(), id, utente.id)?.dati ?? null;
        const esito = scrivi(archivio(), id, utente.id, schedaDa(completaConEsistente(corpo.dati, esistente)), corpo.revisione);
        if (esito.ok) return rispondi(res, 200, { revisione: esito.revisione });
        return esito.attuale ? rispondi(res, 409, esito.attuale) : rispondi(res, 404, { errore: "Personaggio inesistente" });
      }
    }
    rispondi(res, 404, { errore: "Risorsa inesistente" });
  }

  const gestore: Connect.NextHandleFunction = (req, res) => {
    const percorso = (req.url ?? "/").split("?")[0];
    gestisci(req, res, percorso).catch(errore => {
      if (errore instanceof ErroreRichiesta) return rispondi(res, errore.stato, { errore: errore.message });
      console.error("Errore nell'API", errore);
      rispondi(res, 500, { errore: "Errore dell'archivio" });
    });
  };

  return {
    name: "api-personaggio",
    configureServer: server => void server.middlewares.use("/api", gestore),
    configurePreviewServer: server => void server.middlewares.use("/api", gestore),
  };
}
