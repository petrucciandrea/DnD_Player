import type { FastifyInstance } from "fastify";
import { catalogoCreazione, elencoIncantesimi, privilegiDiClasse } from "../catalogo.ts";
import { ErroreRichiesta } from "../errori.ts";
import { richiediUtente } from "../sessione.ts";

export async function rotteCatalogo(app: FastifyInstance) {
  app.addHook("preHandler", richiediUtente);

  app.get("/incantesimi", async () => elencoIncantesimi(app.db));
  app.get("/creazione", async () => catalogoCreazione(app.db));

  app.get<{ Params: { classe: string }; Querystring: Record<string, string | undefined> }>(
    "/classi/:classe/privilegi",
    async richiesta => {
      const parametri = richiesta.query;
      const cumulativo = parametri.fino !== undefined;
      const livello = Number(cumulativo ? parametri.fino : parametri.livello);
      if (!Number.isInteger(livello) || livello < 1 || livello > 20) throw new ErroreRichiesta(400, "Livello non valido");
      return privilegiDiClasse(app.db, {
        classe: richiesta.params.classe, ...(cumulativo ? { fino: livello } : { livello }),
        sottoclasse: parametri.sottoclasse ?? "",
      });
    },
  );
}
