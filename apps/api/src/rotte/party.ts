import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  aggiungiVoce, avanza, avviaCombattimento, datiIniziativaDa, iniziativaPersonaggio, leggiCombattimento, modificaVoceIniziativa,
  terminaCombattimento, togliVoce,
} from "../combattimento.ts";
import { cancellaVoce, creaVoce, datiVoceDa, modificaVoce, voceDiario, vociDiario } from "../diario.ts";
import { corpoOggetto, ErroreRichiesta } from "../errori.ts";
import { leggiMessaggi, LUNGHEZZA_MESSAGGIO, masterDel, scriviMessaggio, segnaLetto, tiroDa } from "../messaggi.ts";
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
    const membro = await membroDi(app.db, id, io);
    const corpo = corpoOggetto(richiesta.body);
    // Un tiro di dadi: a tutto il gruppo, oppure segreto (solo al Master) se lo fa un giocatore.
    if (corpo.tiro !== undefined) {
      const tiro = tiroDa(corpo.tiro);
      if (corpo.segreto === true && membro.ruolo === "master") throw new ErroreRichiesta(400, "Il Master non può mandare un tiro segreto a sé stesso");
      const destinatarioId = corpo.segreto === true ? await masterDel(app.db, id) : null;
      return risposta.status(201).send({ id: await scriviMessaggio(app.db, id, io, { testo: "", destinatarioId, tiro }) });
    }
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

  // Diario di campagna: tutti i membri leggono e scrivono, solo il Master fissa una voce in alto;
  // una voce la cancellano chi l'ha scritta e il Master.
  app.get<ConId>("/party/:id/diario", async richiesta => {
    const id = idParty(richiesta.params.id);
    await membroDi(app.db, id, utenteDi(richiesta).id);
    return vociDiario(app.db, id);
  });

  app.post<ConId>("/party/:id/diario", async (richiesta, risposta) => {
    const id = idParty(richiesta.params.id);
    const io = utenteDi(richiesta).id;
    const membro = await membroDi(app.db, id, io);
    const dati = datiVoceDa(corpoOggetto(richiesta.body));
    if (dati.fissata && membro.ruolo !== "master") throw new ErroreRichiesta(403, "Solo il Master può fissare una voce");
    return risposta.status(201).send(await creaVoce(app.db, id, io, dati));
  });

  app.put<{ Params: { id: string; voce: string } }>("/party/:id/diario/:voce", async (richiesta, risposta) => {
    const id = idParty(richiesta.params.id);
    const io = utenteDi(richiesta).id;
    const membro = await membroDi(app.db, id, io);
    const vid = idDa(richiesta.params.voce, "Voce inesistente");
    const corpo = corpoOggetto(richiesta.body);
    const dati = datiVoceDa(corpo);
    if (!interoValido(corpo.revisione)) throw new ErroreRichiesta(400, "Serve la revisione");
    const attuale = await voceDiario(app.db, id, vid);
    if (!attuale) throw new ErroreRichiesta(404, "Voce inesistente");
    if (dati.fissata !== undefined && dati.fissata !== attuale.fissata && membro.ruolo !== "master") {
      throw new ErroreRichiesta(403, "Solo il Master può fissare una voce");
    }
    const esito = await modificaVoce(app.db, id, vid, io, dati, corpo.revisione);
    if (esito.ok) return esito.voce;
    if (esito.attuale) return risposta.status(409).send(esito.attuale);
    throw new ErroreRichiesta(404, "Voce inesistente");
  });

  app.delete<{ Params: { id: string; voce: string } }>("/party/:id/diario/:voce", async (richiesta, risposta) => {
    const id = idParty(richiesta.params.id);
    const io = utenteDi(richiesta).id;
    const membro = await membroDi(app.db, id, io);
    const voce = await voceDiario(app.db, id, idDa(richiesta.params.voce, "Voce inesistente"));
    if (!voce) throw new ErroreRichiesta(404, "Voce inesistente");
    if (voce.autoreId !== io && membro.ruolo !== "master") throw new ErroreRichiesta(403, "Può cancellarla solo chi l'ha scritta o il Master");
    await cancellaVoce(app.db, id, voce.id);
    return risposta.status(204).send();
  });

  // Iniziativa: il Master gestisce lo scontro, ogni giocatore inserisce l'iniziativa del suo personaggio.
  type ConVoce = { Params: { id: string; voce: string } };
  const conMaster = async (richiesta: FastifyRequest<ConId>) => {
    const id = idParty(richiesta.params.id);
    richiediMaster(await membroDi(app.db, id, utenteDi(richiesta).id));
    return id;
  };

  app.get<ConId>("/party/:id/combattimento", async richiesta => {
    const id = idParty(richiesta.params.id);
    const membro = await membroDi(app.db, id, utenteDi(richiesta).id);
    return leggiCombattimento(app.db, id, membro.ruolo === "master");
  });

  app.post<ConId>("/party/:id/combattimento", async (richiesta, risposta) => {
    await avviaCombattimento(app.db, await conMaster(richiesta));
    return risposta.status(204).send();
  });

  app.delete<ConId>("/party/:id/combattimento", async (richiesta, risposta) => {
    await terminaCombattimento(app.db, await conMaster(richiesta));
    return risposta.status(204).send();
  });

  app.post<ConId>("/party/:id/combattimento/avanza", async (richiesta, risposta) => {
    const id = await conMaster(richiesta);
    const { direzione } = corpoOggetto(richiesta.body);
    if (direzione !== 1 && direzione !== -1) throw new ErroreRichiesta(400, "Direzione: 1 o -1");
    await avanza(app.db, id, direzione);
    return risposta.status(204).send();
  });

  app.put<ConId>("/party/:id/combattimento/mio", async (richiesta, risposta) => {
    const id = idParty(richiesta.params.id);
    const membro = await membroDi(app.db, id, utenteDi(richiesta).id);
    if (membro.personaggioId === null) throw new ErroreRichiesta(400, "Il Master non ha un personaggio");
    const { valore } = datiIniziativaDa(corpoOggetto(richiesta.body), false);
    if (valore === undefined) throw new ErroreRichiesta(400, "Iniziativa non valida");
    await iniziativaPersonaggio(app.db, id, membro.personaggioId, valore);
    return risposta.status(204).send();
  });

  app.post<ConId>("/party/:id/combattimento/voci", async (richiesta, risposta) => {
    const id = await conMaster(richiesta);
    const voce = await aggiungiVoce(app.db, id, datiIniziativaDa(corpoOggetto(richiesta.body), true));
    return risposta.status(201).send({ id: voce });
  });

  app.put<ConVoce>("/party/:id/combattimento/voci/:voce", async (richiesta, risposta) => {
    const id = await conMaster(richiesta);
    const ok = await modificaVoceIniziativa(app.db, id, idDa(richiesta.params.voce, "Voce inesistente"),
      datiIniziativaDa(corpoOggetto(richiesta.body), false));
    if (!ok) throw new ErroreRichiesta(404, "Voce inesistente");
    return risposta.status(204).send();
  });

  app.delete<ConVoce>("/party/:id/combattimento/voci/:voce", async (richiesta, risposta) => {
    const id = await conMaster(richiesta);
    if (!(await togliVoce(app.db, id, idDa(richiesta.params.voce, "Voce inesistente")))) throw new ErroreRichiesta(404, "Voce inesistente");
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
