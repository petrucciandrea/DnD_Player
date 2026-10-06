import { costruisciApp } from "./app.ts";
import { leggiConfig } from "./config.ts";
import { creaPool } from "./db.ts";

// Avvio del server: in sviluppo con `npm run dev` (tsx), in produzione dal bundle di esbuild (Dockerfile).
const config = leggiConfig();
const pool = creaPool(config.databaseUrl);
const app = await costruisciApp({ db: pool, produzione: config.produzione, logger: true });

// Render ferma il servizio con SIGTERM: si finiscono le richieste in corso e si chiude il pool.
for (const segnale of ["SIGTERM", "SIGINT"] as const) {
  process.once(segnale, async () => {
    app.log.info(`${segnale}: chiusura del server`);
    await app.close();
    await pool.end();
    process.exit(0);
  });
}

await app.listen({ host: "0.0.0.0", port: config.porta });
