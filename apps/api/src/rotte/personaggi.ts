import type { FastifyInstance } from "fastify";
import { completaConEsistente, daJSON } from "@dnd/regole/scheda.ts";
import type { CharacterData } from "@dnd/regole/tipi.ts";
import { leggi, scrivi } from "../archivio.ts";
import { corpoOggetto, ErroreRichiesta } from "../errori.ts";
import { idDa, interoValido } from "../parametri.ts";
import { creaPersonaggio, elencoPersonaggi } from "../personaggi.ts";
import { richiediUtente, utenteDi } from "../sessione.ts";

// Una scheda di una versione precedente (pesi in libbre) arriva solo da una pagina aperta prima
// dell'aggiornamento e va ricaricata: non si può sapere se i suoi pesi sono ancora in libbre.
// Il client converte da solo le schede vecchie (daJSON) prima di inviarle.
function controllaVersione(dati: unknown) {
  if (typeof dati === "object" && dati !== null && "versione" in dati && dati.versione !== 3) {
    throw new ErroreRichiesta(400, "Versione dell'app obsoleta: ricarica la pagina");
  }
}

// La scheda arriva dal client: la si valida e normalizza come per un import.
function schedaDa(dati: unknown): CharacterData {
  try {
    return daJSON(dati);
  } catch {
    throw new ErroreRichiesta(400, "Scheda personaggio non valida");
  }
}

const idPersonaggio = (parametro: string) => idDa(parametro, "Personaggio inesistente");

export async function rottePersonaggi(app: FastifyInstance) {
  app.addHook("preHandler", richiediUtente);

  app.get("/personaggi", async richiesta => elencoPersonaggi(app.db, utenteDi(richiesta).id));

  app.post("/personaggi", async (richiesta, risposta) => {
    const dati = corpoOggetto(richiesta.body).dati;
    controllaVersione(dati);
    const scheda = schedaDa(dati);
    return risposta.status(201).send({ id: await creaPersonaggio(app.db, utenteDi(richiesta).id, scheda) });
  });

  app.get<{ Params: { id: string } }>("/personaggi/:id", async richiesta => {
    const versione = await leggi(app.db, idPersonaggio(richiesta.params.id), utenteDi(richiesta).id);
    if (!versione) throw new ErroreRichiesta(404, "Personaggio inesistente");
    return versione;
  });

  app.put<{ Params: { id: string } }>("/personaggi/:id", async (richiesta, risposta) => {
    const utente = utenteDi(richiesta);
    const id = idPersonaggio(richiesta.params.id);
    const corpo = corpoOggetto(richiesta.body);
    const { revisione } = corpo;
    if (!interoValido(revisione)) {
      throw new ErroreRichiesta(400, "Servono dati e revisione");
    }
    controllaVersione(corpo.dati);
    // I campi che il client non invia (versione vecchia dell'app) restano quelli salvati.
    const esistente = (await leggi(app.db, id, utente.id))?.dati ?? null;
    if (!esistente) throw new ErroreRichiesta(404, "Personaggio inesistente");
    const esito = await scrivi(app.db, id, utente.id, schedaDa(completaConEsistente(corpo.dati, esistente)), revisione);
    if (esito.ok) return { revisione: esito.revisione };
    if (esito.attuale) return risposta.status(409).send(esito.attuale);
    throw new ErroreRichiesta(404, "Personaggio inesistente");
  });
}
