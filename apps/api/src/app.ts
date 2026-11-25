import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyBaseLogger, type FastifyError, type FastifyInstance, type FastifyServerOptions } from "fastify";
import type { Utente } from "@dnd/regole/api.ts";
import type pg from "pg";
import { ErroreRichiesta } from "./errori.ts";
import { rotteAccesso } from "./rotte/accesso.ts";
import { rotteCatalogo } from "./rotte/catalogo.ts";
import { rotteParty } from "./rotte/party.ts";
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
// Party (404 se l'utente non ne fa parte, 403 se un giocatore chiede un'azione del Master):
//   GET  /party                                → party dell'utente (riassunto)
//   POST /party { nome }                       → crea un party di cui l'utente è il Master → { id, codice }
//   POST /party/entra { codice, personaggioId } → { id }; 404 se il codice non vale, 409 se il personaggio è già in un party
//   GET  /party/:id                            → { nome, codice (solo al Master), membri con il riepilogo dei personaggi, io }
//   PUT  /party/:id { nome }                   → 204 (Master)
//   POST /party/:id/codice                     → { codice } nuovo; il vecchio non vale più (Master)
//   DELETE /party/:id                          → 204, scioglie il party (Master)
//   DELETE /party/:id/membri/:utente           → 204; un giocatore esce, il Master espelle
//   GET  /party/:id/personaggi/:personaggio    → scheda completa di un personaggio del party (Master)
//   GET  /party/:id/messaggi?dopo=n | prima=n  → { messaggi (gruppo e privati dell'utente), letture }
//   POST /party/:id/messaggi { testo, destinatarioId? } → { id }; destinatario: un altro membro (privato)
//   POST /party/:id/messaggi { tiro, segreto? } → { id }; un tiro di dadi, segreto = solo al Master
//   PUT  /party/:id/letto { con, fino }        → 204; segna letta la conversazione (con 0 = gruppo)
//   GET  /party/:id/diario                     → voci del diario (prima le fissate)
//   POST /party/:id/diario { titolo, testo, categoria, fissata? } → la voce; fissata solo dal Master (403)
//   PUT  /party/:id/diario/:voce { …, revisione } → la voce, 409 con la versione attuale
//   DELETE /party/:id/diario/:voce             → 204; solo l'autore o il Master (403)
//   GET  /party/:id/combattimento              → { attivo, round, diTurno, voci in ordine } (le nascoste solo al Master)
//   POST /party/:id/combattimento · DELETE …   → 204; avvia o termina lo scontro (Master)
//   POST /party/:id/combattimento/avanza { direzione: 1 | -1 } → 204; turno successivo o precedente (Master)
//   PUT  /party/:id/combattimento/mio { valore } → 204; iniziativa del proprio personaggio (bonus dalla scheda)
//   POST /party/:id/combattimento/voci { nome, valore, bonus?, nascosto? } → { id }; PUT e DELETE …/voci/:voce (Master)
//   GET  /party/:id/tesoro                     → { monete, oggetti (bottino da assegnare), portati (oggetti del party negli Zaini), movimenti }
//   POST /party/:id/tesoro/monete { delta }    → monete del tesoro; 409 se non bastano
//   POST /party/:id/tesoro/oggetti { nome, qta, peso, … } → { id }; si somma a un oggetto uguale
//   POST /party/:id/tesoro/oggetti/:oggetto/prendi { qta, delParty? } → l'oggetto preso; 404 se non c'è più, 409 se non basta
//   DELETE /party/:id/tesoro/oggetti/:oggetto  → 204; il Master toglie l'oggetto dal tesoro
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
    await api.register(rotteParty);
  }, { prefix: "/api" });

  return app;
}
