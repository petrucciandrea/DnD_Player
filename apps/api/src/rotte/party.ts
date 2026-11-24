import type { FastifyInstance, FastifyRequest } from "fastify";
import { corpoOggetto, ErroreRichiesta } from "../errori.ts";
import { leggiMessaggi, LUNGHEZZA_MESSAGGIO, scriviMessaggio, segnaLetto } from "../messaggi.ts";
import { idDa, interoValido } from "../parametri.ts";
import {
  creaParty, dettaglioParty, elencoParty, eMembro, entraNelParty, LUNGHEZZA_NOME, membroDi, personaggioNelParty, richiediMaster,
  rigeneraCodice, rinominaParty, sciogliParty, togliMembro,
} from "../party.ts";
import { componi } from "../personaggi.ts";
import { richiediUtente, tokenDa, utenteDi } from "../sessione.ts";

// Il codice d'invito è l'unica protezione del party: si limita chi prova molti codici.
const LIMITE_INGRESSO = { max: 10, timeWindow: "5 minutes", keyGenerator: (r: FastifyRequest) => tokenDa(r) ?? r.ip } as const;

const LIMITE_MESSAGGI = { max: 30, timeWindow: "1 minute", keyGenerator: (r: FastifyRequest) => tokenDa(r) ?? r.ip } as const;

type ConId = { Params: { id: string } };

// Cursore dei messaggi dalla query string (id positivo), assente se manca.
function cursoreDa(valore: unknown): number | undefined {
  if (valore === undefined) return undefined;
  const n = typeof valore === "string" && /^\d{1,15}$/.test(valore) ? Number(valore) : NaN;
  if (!Number.isSafeInteger(n)) throw new ErroreRichiesta(400, "Cursore dei messaggi non valido");
  return n;
}

const idMessaggioValido = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;

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

  app.get<ConId & { Querystring: { dopo?: string; prima?: string } }>("/party/:id/messaggi", async richiesta => {
    const id = idParty(richiesta.params.id);
    const io = utenteDi(richiesta).id;
    await membroDi(app.db, id, io);
    const { dopo, prima } = richiesta.query;
    return leggiMessaggi(app.db, id, io, { dopo: cursoreDa(dopo), prima: cursoreDa(prima) });
  });

  app.post<ConId>("/party/:id/messaggi", { config: { rateLimit: LIMITE_MESSAGGI } }, async (richiesta, risposta) => {
    const id = idParty(richiesta.params.id);
    const io = utenteDi(richiesta).id;
    await membroDi(app.db, id, io);
    const corpo = corpoOggetto(richiesta.body);
    const testo = typeof corpo.testo === "string" ? corpo.testo.trim() : "";
    if (testo.length < 1 || testo.length > LUNGHEZZA_MESSAGGIO) {
      throw new ErroreRichiesta(400, `Il messaggio deve avere da 1 a ${LUNGHEZZA_MESSAGGIO} caratteri`);
    }
    const destinatarioId = await destinatarioDa(app, id, io, corpo.destinatarioId);
    return risposta.status(201).send({ id: await scriviMessaggio(app.db, id, io, { testo, destinatarioId }) });
  });

  // Fin dove si è letta una conversazione: `con` 0 = gruppo, altrimenti l'altro utente del privato.
  app.put<ConId>("/party/:id/letto", async (richiesta, risposta) => {
    const id = idParty(richiesta.params.id);
    const io = utenteDi(richiesta).id;
    await membroDi(app.db, id, io);
    const { con, fino } = corpoOggetto(richiesta.body);
    if (!interoValido(con) || !idMessaggioValido(fino)) throw new ErroreRichiesta(400, "Servono con e fino");
    await segnaLetto(app.db, id, io, con, fino);
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

// Destinatario di un messaggio privato: un altro membro del party (null = a tutto il gruppo).
async function destinatarioDa(app: FastifyInstance, partyId: number, io: number, valore: unknown): Promise<number | null> {
  if (valore === undefined || valore === null) return null;
  if (!interoValido(valore) || valore === io || !(await eMembro(app.db, partyId, valore))) {
    throw new ErroreRichiesta(400, "Il destinatario deve essere un altro membro del party");
  }
  return valore;
}
