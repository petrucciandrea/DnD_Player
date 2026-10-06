import { aggiornaCataloghi } from "../src/catalogo.ts";
import { leggiConfig } from "../src/config.ts";
import { creaPool } from "../src/db.ts";

// Aggiorna le voci ufficiali dei cataloghi (seed di @dnd/regole/semi) nel database di DATABASE_URL.
const pool = creaPool(leggiConfig().databaseUrl, { max: 1 });
try {
  const inizio = Date.now();
  await aggiornaCataloghi(pool);
  console.info(`Cataloghi aggiornati in ${Date.now() - inizio} ms.`);
} finally {
  await pool.end();
}
