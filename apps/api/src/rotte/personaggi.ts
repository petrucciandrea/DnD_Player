import type { FastifyInstance } from "fastify";
import { completaConEsistente, daJSON } from "@dnd/regole/scheda.ts";
import type { CharacterData } from "@dnd/regole/tipi.ts";
import { leggi, scrivi } from "../archivio.ts";
import { corpoOggetto, ErroreRichiesta } from "../errori.ts";
import { creaPersonaggio, elencoPersonaggi } from "../personaggi.ts";
import { richiediUtente, utenteDi } from "../sessione.ts";

const MASSIMO_INTERO = 2_147_483_647; // integer di PostgreSQL

// La scheda arriva dal client: la si valida e normalizza come per un import.
function schedaDa(dati: unknown): CharacterData {
  try {
    return daJSON(dati);
  } catch {
    throw new ErroreRichiesta(400, "Scheda personaggio non valida");
  }
}

// Id dal percorso; uno che non può esistere vale come personaggio inesistente.
function idDa(parametro: string): number {
  const id = /^\d{1,10}$/.test(parametro) ? Number(parametro) : NaN;
  if (!(id >= 1 && id <= MASSIMO_INTERO)) throw new ErroreRichiesta(404, "Personaggio inesistente");
  return id;
}

export async function rottePersonaggi(app: FastifyInstance) {
  app.addHook("preHandler", richiediUtente);

  app.get("/personaggi", async richiesta => elencoPersonaggi(app.db, utenteDi(richiesta).id));

  app.post("/personaggi", async (richiesta, risposta) => {
    const scheda = schedaDa(corpoOggetto(richiesta.body).dati);
    return risposta.status(201).send({ id: await creaPersonaggio(app.db, utenteDi(richiesta).id, scheda) });
  });

  app.get<{ Params: { id: string } }>("/personaggi/:id", async richiesta => {
    const versione = await leggi(app.db, idDa(richiesta.params.id), utenteDi(richiesta).id);
    if (!versione) throw new ErroreRichiesta(404, "Personaggio inesistente");
    return versione;
  });

  app.put<{ Params: { id: string } }>("/personaggi/:id", async (richiesta, risposta) => {
    const utente = utenteDi(richiesta);
    const id = idDa(richiesta.params.id);
    const corpo = corpoOggetto(richiesta.body);
    const { revisione } = corpo;
    if (typeof revisione !== "number" || !Number.isInteger(revisione) || revisione < 0 || revisione > MASSIMO_INTERO) {
      throw new ErroreRichiesta(400, "Servono dati e revisione");
    }
    // I campi che il client non invia (versione vecchia dell'app) restano quelli salvati.
    const esistente = (await leggi(app.db, id, utente.id))?.dati ?? null;
    if (!esistente) throw new ErroreRichiesta(404, "Personaggio inesistente");
    const esito = await scrivi(app.db, id, utente.id, schedaDa(completaConEsistente(corpo.dati, esistente)), revisione);
    if (esito.ok) return { revisione: esito.revisione };
    if (esito.attuale) return risposta.status(409).send(esito.attuale);
    throw new ErroreRichiesta(404, "Personaggio inesistente");
  });
}
