import type { FastifyInstance, FastifyRequest } from "fastify";
import { corpoOggetto, ErroreRichiesta } from "../errori.ts";
import { idDa, interoValido } from "../parametri.ts";
import {
  creaParty, dettaglioParty, elencoParty, entraNelParty, LUNGHEZZA_NOME, membroDi, personaggioNelParty, richiediMaster,
  rigeneraCodice, rinominaParty, sciogliParty, togliMembro,
} from "../party.ts";
import { componi } from "../personaggi.ts";
import { richiediUtente, tokenDa, utenteDi } from "../sessione.ts";

// Il codice d'invito è l'unica protezione del party: si limita chi prova molti codici.
const LIMITE_INGRESSO = { max: 10, timeWindow: "5 minutes", keyGenerator: (r: FastifyRequest) => tokenDa(r) ?? r.ip } as const;

type ConId = { Params: { id: string } };

const idParty = (parametro: string) => idDa(parametro, "Party inesistente");

function nomeDa(corpo: unknown): string {
  const { nome } = corpoOggetto(corpo);
  const pulito = typeof nome === "string" ? nome.trim() : "";
  if (pulito.length < 1 || pulito.length > LUNGHEZZA_NOME) {
    throw new ErroreRichiesta(400, `Il nome del party deve avere da 1 a ${LUNGHEZZA_NOME} caratteri`);
  }
  return pulito;
}

export async function rotteParty(app: FastifyInstance) {
  app.addHook("preHandler", richiediUtente);

  app.get("/party", async richiesta => elencoParty(app.db, utenteDi(richiesta).id));

  app.post("/party", async (richiesta, risposta) => {
    const nome = nomeDa(richiesta.body);
    return risposta.status(201).send(await creaParty(app.db, utenteDi(richiesta).id, nome));
  });

  app.post("/party/entra", { config: { rateLimit: LIMITE_INGRESSO } }, async (richiesta, risposta) => {
    const { codice, personaggioId } = corpoOggetto(richiesta.body);
    if (typeof codice !== "string" || !interoValido(personaggioId)) throw new ErroreRichiesta(400, "Servono codice e personaggio");
    const id = await entraNelParty(app.db, utenteDi(richiesta).id, codice, personaggioId);
    return risposta.status(201).send({ id });
  });

  app.get<ConId>("/party/:id", async richiesta =>
    dettaglioParty(app.db, idParty(richiesta.params.id), utenteDi(richiesta).id));

  app.put<ConId>("/party/:id", async (richiesta, risposta) => {
    const id = idParty(richiesta.params.id);
    richiediMaster(await membroDi(app.db, id, utenteDi(richiesta).id));
    await rinominaParty(app.db, id, nomeDa(richiesta.body));
    return risposta.status(204).send();
  });

  app.post<ConId>("/party/:id/codice", async richiesta => {
    const id = idParty(richiesta.params.id);
    richiediMaster(await membroDi(app.db, id, utenteDi(richiesta).id));
    return { codice: await rigeneraCodice(app.db, id) };
  });

  app.delete<ConId>("/party/:id", async (richiesta, risposta) => {
    const id = idParty(richiesta.params.id);
    richiediMaster(await membroDi(app.db, id, utenteDi(richiesta).id));
    await sciogliParty(app.db, id);
    return risposta.status(204).send();
  });

  // Un giocatore esce da solo; il Master può togliere chiunque tranne sé stesso (scioglie il party).
  app.delete<{ Params: { id: string; utente: string } }>("/party/:id/membri/:utente", async (richiesta, risposta) => {
    const id = idParty(richiesta.params.id);
    const io = utenteDi(richiesta).id;
    const membro = await membroDi(app.db, id, io);
    const bersaglio = idDa(richiesta.params.utente, "Membro inesistente");
    if (bersaglio !== io) richiediMaster(membro);
    else if (membro.ruolo === "master") throw new ErroreRichiesta(409, "Il Master non può uscire: può sciogliere il party");
    if (!(await togliMembro(app.db, id, bersaglio))) throw new ErroreRichiesta(404, "Membro inesistente");
    return risposta.status(204).send();
  });

  // Scheda completa di un personaggio del party, in sola lettura: solo per il Master.
  app.get<{ Params: { id: string; personaggio: string } }>("/party/:id/personaggi/:personaggio", async richiesta => {
    const id = idParty(richiesta.params.id);
    richiediMaster(await membroDi(app.db, id, utenteDi(richiesta).id));
    const pid = idDa(richiesta.params.personaggio, "Personaggio inesistente");
    const scheda = (await personaggioNelParty(app.db, id, pid)) ? await componi(app.db, pid) : null;
    if (!scheda) throw new ErroreRichiesta(404, "Personaggio inesistente");
    return scheda;
  });
}
