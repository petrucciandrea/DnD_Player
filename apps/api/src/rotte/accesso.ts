import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  apriSessione, cambiaPassword, cambiaUsername, chiudiSessione, creaUtente, errorePassword, erroreRegistrazione, erroreUsername,
  passwordDiUtente, verificaCredenziali,
} from "../accesso.ts";
import { corpoOggetto, ErroreRichiesta } from "../errori.ts";
import { attendiDopoErrore, cancellaCookie, impostaCookie, richiediUtente, tokenDa, utenteDi } from "../sessione.ts";

const credenzialiDa = (corpo: unknown) => {
  const { username, password } = corpoOggetto(corpo);
  if (typeof username !== "string" || typeof password !== "string") throw new ErroreRichiesta(400, "Servono username e password");
  return { username, password };
};

// Limiti ai tentativi, oltre all'attesa dopo una password sbagliata. L'accesso si limita per username
// (protegge l'account anche da tentativi che arrivano da molti indirizzi), il resto per indirizzo o sessione.
const usernameDellaRichiesta = (richiesta: FastifyRequest) => {
  const corpo = richiesta.body as { username?: unknown } | undefined;
  return typeof corpo?.username === "string" ? `u:${corpo.username.trim().toLowerCase()}` : `ip:${richiesta.ip}`;
};
const LIMITE_ACCESSO = { max: 10, timeWindow: "5 minutes", hook: "preHandler", keyGenerator: usernameDellaRichiesta } as const;
const LIMITE_REGISTRAZIONE = { max: 10, timeWindow: "1 hour" } as const;
const LIMITE_ACCOUNT = { max: 10, timeWindow: "5 minutes", keyGenerator: (r: FastifyRequest) => tokenDa(r) ?? r.ip } as const;

export async function rotteAccesso(app: FastifyInstance) {
  app.post("/registrazione", { config: { rateLimit: LIMITE_REGISTRAZIONE } }, async (richiesta, risposta) => {
    const { username, password } = credenzialiDa(richiesta.body);
    const errore = erroreRegistrazione(username, password);
    if (errore) throw new ErroreRichiesta(400, errore);
    const utente = await creaUtente(app.db, username, password);
    if (!utente) throw new ErroreRichiesta(409, "Questo username è già in uso.");
    impostaCookie(richiesta, risposta, await apriSessione(app.db, utente.id));
    return risposta.status(201).send(utente);
  });

  app.post("/accesso", { config: { rateLimit: LIMITE_ACCESSO } }, async (richiesta, risposta) => {
    const { username, password } = credenzialiDa(richiesta.body);
    const utente = await verificaCredenziali(app.db, username, password);
    if (!utente) {
      await attendiDopoErrore(richiesta);
      throw new ErroreRichiesta(401, "Username o password non corretti");
    }
    impostaCookie(richiesta, risposta, await apriSessione(app.db, utente.id));
    return utente;
  });

  app.post("/uscita", async (richiesta, risposta) => {
    const token = tokenDa(richiesta);
    if (token) await chiudiSessione(app.db, token);
    cancellaCookie(richiesta, risposta);
    return risposta.status(204).send();
  });

  // Rotte riservate a chi ha una sessione.
  await app.register(async riservate => {
    riservate.addHook("preHandler", richiediUtente);

    riservate.get("/sessione", async richiesta => utenteDi(richiesta));

    // Per cambiare username o password serve la password attuale. 403 e non 401:
    // per il client 401 significa "sessione scaduta".
    const passwordSbagliata = async (richiesta: FastifyRequest) => {
      await attendiDopoErrore(richiesta);
      return new ErroreRichiesta(403, "La password attuale non è corretta.");
    };

    riservate.put("/account/username", { config: { rateLimit: LIMITE_ACCOUNT } }, async richiesta => {
      const utente = utenteDi(richiesta);
      const { username, password } = credenzialiDa(richiesta.body);
      if (!(await passwordDiUtente(app.db, utente.id, password))) throw await passwordSbagliata(richiesta);
      const errore = erroreUsername(username);
      if (errore) throw new ErroreRichiesta(400, errore);
      const aggiornato = await cambiaUsername(app.db, utente.id, username);
      if (!aggiornato) throw new ErroreRichiesta(409, "Questo username è già in uso.");
      return aggiornato;
    });

    riservate.put("/account/password", { config: { rateLimit: LIMITE_ACCOUNT } }, async (richiesta, risposta) => {
      const utente = utenteDi(richiesta);
      const { attuale, nuova } = corpoOggetto(richiesta.body);
      if (typeof attuale !== "string" || typeof nuova !== "string") throw new ErroreRichiesta(400, "Servono la password attuale e quella nuova");
      if (!(await passwordDiUtente(app.db, utente.id, attuale))) throw await passwordSbagliata(richiesta);
      const errore = errorePassword(nuova);
      if (errore) throw new ErroreRichiesta(400, errore);
      await cambiaPassword(app.db, utente.id, nuova, tokenDa(richiesta)!);
      return risposta.status(204).send();
    });
  });
}
