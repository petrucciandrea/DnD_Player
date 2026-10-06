import type { FastifyInstance } from "fastify";
import { riga } from "../db.ts";

// Health check di Render: il servizio è pronto se il database risponde. Senza log delle richieste,
// perché Render lo chiama di continuo.
export async function rotteSalute(app: FastifyInstance) {
  app.get("/salute", { logLevel: "warn" }, async (_richiesta, risposta) => {
    try {
      await riga(app.db, "SELECT 1");
      return { ok: true };
    } catch {
      return risposta.status(503).send({ ok: false, errore: "Database non raggiungibile" });
    }
  });
}
