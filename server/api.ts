import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";
import type { Connect, Plugin } from "vite";
import { apriSessione, chiudiSessione, DURATA_SESSIONE, leggiSessione, verificaCredenziali } from "./accesso.ts";
import { apriArchivio, leggi, scrivi } from "./archivio.ts";

// DND_ARCHIVIO permette di usare un altro file, per esempio per le prove.
export const PERCORSO_ARCHIVIO = resolve(process.env.DND_ARCHIVIO ?? "archivio/dnd_player.sqlite");
const COOKIE = "dnd_sessione";
const ATTESA_ERRORE_ACCESSO = 1000; // ms: rallenta i tentativi di indovinare la password

const rispondi = (res: ServerResponse, stato: number, corpo?: unknown) => {
  res.statusCode = stato;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(corpo === undefined ? "" : JSON.stringify(corpo));
};

async function leggiCorpo(req: IncomingMessage): Promise<unknown> {
  const parti: Buffer[] = [];
  for await (const parte of req) parti.push(parte as Buffer);
  return JSON.parse(Buffer.concat(parti).toString("utf8"));
}

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

// API montata sia nel server di sviluppo sia in quello di anteprima:
//   POST /api/accesso { username, password } → { username, personaggio } e cookie di sessione, oppure 401
//   GET  /api/sessione → { username, personaggio } oppure 401
//   POST /api/uscita → chiude la sessione
//   GET  /api/personaggio → { dati, revisione } oppure 404 se l'archivio non ha ancora la scheda
//   PUT  /api/personaggio { dati, revisione } → { revisione } oppure 409 con la versione attuale
// Tutto tranne l'accesso richiede una sessione valida (altrimenti 401).
export function apiPersonaggio(): Plugin {
  let db: ReturnType<typeof apriArchivio> | null = null;
  const archivio = () => (db ??= apriArchivio(PERCORSO_ARCHIVIO));

  async function gestisci(req: IncomingMessage, res: ServerResponse, percorso: string) {
    const metodo = req.method ?? "GET";

    if (percorso === "/accesso" && metodo === "POST") {
      const corpo = await leggiCorpo(req).catch(() => null);
      const { username, password } = (corpo ?? {}) as { username?: unknown; password?: unknown };
      if (typeof username !== "string" || typeof password !== "string") {
        return rispondi(res, 400, { errore: "Servono username e password" });
      }
      const utente = verificaCredenziali(archivio(), username, password);
      if (!utente) {
        await new Promise(r => setTimeout(r, ATTESA_ERRORE_ACCESSO));
        return rispondi(res, 401, { errore: "Username o password non corretti" });
      }
      impostaCookie(res, apriSessione(archivio(), utente.username), DURATA_SESSIONE);
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

    if (percorso === "/personaggio" && metodo === "GET") {
      const versione = leggi(archivio(), utente.personaggio);
      return versione ? rispondi(res, 200, versione) : rispondi(res, 404);
    }
    if (percorso === "/personaggio" && metodo === "PUT") {
      const corpo = await leggiCorpo(req).catch(() => undefined);
      if (corpo === undefined) return rispondi(res, 400, { errore: "JSON non valido" });
      const { dati, revisione } = (corpo ?? {}) as { dati?: unknown; revisione?: unknown };
      if (typeof dati !== "object" || dati === null || typeof revisione !== "number") {
        return rispondi(res, 400, { errore: "Servono dati e revisione" });
      }
      const esito = scrivi(archivio(), utente.personaggio, dati, revisione);
      return esito.ok ? rispondi(res, 200, { revisione: esito.revisione }) : rispondi(res, 409, esito.attuale);
    }
    rispondi(res, 404, { errore: "Risorsa inesistente" });
  }

  const gestore: Connect.NextHandleFunction = (req, res) => {
    const percorso = (req.url ?? "/").split("?")[0];
    gestisci(req, res, percorso).catch(errore => {
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
