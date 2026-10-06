import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyBaseLogger, type FastifyError, type FastifyInstance, type FastifyServerOptions } from "fastify";
import type { Utente } from "@dnd/regole/api.ts";
import type pg from "pg";
import { ErroreRichiesta } from "./errori.ts";
import { rotteAccesso } from "./rotte/accesso.ts";
import { rotteCatalogo } from "./rotte/catalogo.ts";
import { rottePersonaggi } from "./rotte/personaggi.ts";
import { rotteSalute } from "./rotte/salute.ts";

// L'API sotto /api. Le rotte e i codici di risposta sono quelli che il client si aspetta:
//   POST /registrazione { username, password } → { id, username } e cookie di sessione; 400 o 409 se non valida
//   POST /accesso { username, password }       → { id, username } e cookie di sessione, oppure 401 (dopo 1 s)
//   POST /uscita                               → chiude la sessione
//   GET  /salute                               → { ok } se il database risponde (health check di Render)
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
//   GET  /classi/:classe/privilegi?livello=n&sottoclasse=… → privilegi di classe di quel livello (con fino=n: fino a quel livello)
// Gli errori hanno sempre la forma { errore: "messaggio per l'utente" }.

export interface OpzioniApp {
  db: pg.Pool;
  produzione: boolean; // cookie Secure (in produzione si passa sempre da https)
  logger?: FastifyServerOptions["logger"];
  attesaErrore?: number; // ms prima di rispondere a una password sbagliata; i test la abbassano
}

declare module "fastify" {
  interface FastifyInstance {
    db: pg.Pool;
    produzione: boolean;
    attesaErrore: number;
  }
  interface FastifyRequest {
    utente: Utente | null;
  }
}

export const DIMENSIONE_MASSIMA_CORPO = 2 * 1024 * 1024; // byte: una scheda con l'avatar ci sta abbondantemente

export async function costruisciApp(opzioni: OpzioniApp): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opzioni.logger ?? false,
    // Si arriva passando da Vercel e dal proxy di Render: l'IP del client è in X-Forwarded-For.
    trustProxy: true,
    bodyLimit: DIMENSIONE_MASSIMA_CORPO,
  });
  app.decorate("db", opzioni.db);
  app.decorate("produzione", opzioni.produzione);
  app.decorate("attesaErrore", opzioni.attesaErrore ?? 1000);
  app.decorateRequest("utente", null);

  await app.register(helmet, { global: true });
  await app.register(cookie);
  // Limiti solo dove servono (accesso, registrazione, account): ogni rotta ha il suo in `config.rateLimit`.
  await app.register(rateLimit, {
    global: false,
    errorResponseBuilder: (_richiesta, contesto) => {
      const errore = new ErroreRichiesta(429, `Troppi tentativi: riprova tra ${contesto.after}.`);
      return errore;
    },
  });

  app.addHook("onSend", async (_richiesta, risposta) => {
    risposta.header("Cache-Control", "no-store");
  });

  app.setErrorHandler((errore: FastifyError, richiesta, risposta) => {
    if (errore instanceof ErroreRichiesta) return risposta.status(errore.stato).send({ errore: errore.message });
    if (errore.code === "FST_ERR_CTP_BODY_TOO_LARGE") return risposta.status(413).send({ errore: "Richiesta troppo grande" });
    if (errore.code === "FST_ERR_CTP_INVALID_MEDIA_TYPE" || errore.code === "FST_ERR_CTP_EMPTY_JSON_BODY"
      || errore.statusCode === 400) {
      return risposta.status(400).send({ errore: "JSON non valido" });
    }
    (richiesta.log as FastifyBaseLogger).error({ err: errore }, "Errore nell'API");
    return risposta.status(500).send({ errore: "Errore dell'archivio" });
  });
  app.setNotFoundHandler((_richiesta, risposta) => risposta.status(404).send({ errore: "Risorsa inesistente" }));

  await app.register(async api => {
    await api.register(rotteSalute);
    await api.register(rotteAccesso);
    await api.register(rottePersonaggi);
    await api.register(rotteCatalogo);
  }, { prefix: "/api" });

  return app;
}
