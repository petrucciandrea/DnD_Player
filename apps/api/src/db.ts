import pg from "pg";

// Connessione a PostgreSQL. Tutte le funzioni dell'archivio ricevono un `Esecutore`: il pool,
// oppure il client di una transazione in corso.

export type Esecutore = pg.Pool | pg.PoolClient;
export type Riga = Record<string, unknown>;

// Neon aggiunge all'URL parametri che node-postgres non conosce (channel_binding) o interpreta
// in modo diverso da libpq (sslmode=require vale come verify-full). Si tolgono dall'URL e l'SSL
// si imposta a parte: cifrato e con il certificato verificato.
export function opzioniConnessione(url: string): pg.PoolConfig {
  const u = new URL(url);
  const sslmode = u.searchParams.get("sslmode");
  for (const p of ["sslmode", "channel_binding", "sslrootcert", "sslcert", "sslkey"]) u.searchParams.delete(p);
  const ssl = sslmode !== null && sslmode !== "disable";
  return { connectionString: u.toString(), ...(ssl ? { ssl: { rejectUnauthorized: true } } : {}) };
}

export function creaPool(url: string, opzioni: pg.PoolConfig = {}): pg.Pool {
  const pool = new pg.Pool({ max: 5, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 15_000, ...opzioniConnessione(url), ...opzioni });
  // Un client inattivo che perde la connessione (Neon si sospende) non deve far cadere il processo.
  pool.on("error", errore => console.error("Connessione al database interrotta", errore));
  return pool;
}

export async function riga(db: Esecutore, sql: string, valori: unknown[] = []): Promise<Riga | undefined> {
  return (await db.query(sql, valori)).rows[0];
}

export async function righe(db: Esecutore, sql: string, valori: unknown[] = []): Promise<Riga[]> {
  return (await db.query(sql, valori)).rows;
}

const inTransazione = new WeakSet<pg.PoolClient>();
let contatore = 0;

// Esegue `operazione` tutta o niente. Dentro una transazione già aperta usa un SAVEPOINT,
// così si può annidare (per esempio `scrivi` chiama `scomponi`, che ha la sua).
export async function transazione<T>(db: Esecutore, operazione: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  if (!(db instanceof pg.Pool) && inTransazione.has(db)) {
    const nome = `t${++contatore}`;
    await db.query(`SAVEPOINT ${nome}`);
    try {
      const risultato = await operazione(db);
      await db.query(`RELEASE SAVEPOINT ${nome}`);
      return risultato;
    } catch (errore) {
      await db.query(`ROLLBACK TO SAVEPOINT ${nome}`);
      throw errore;
    }
  }
  const client = db instanceof pg.Pool ? await db.connect() : db;
  inTransazione.add(client);
  try {
    await client.query("BEGIN");
    const risultato = await operazione(client);
    await client.query("COMMIT");
    return risultato;
  } catch (errore) {
    await client.query("ROLLBACK").catch(() => {});
    throw errore;
  } finally {
    inTransazione.delete(client);
    if (db instanceof pg.Pool) client.release();
  }
}

// Inserisce più righe con una sola query. `colonne` dà l'ordine dei valori di ogni riga;
// `coda` si aggiunge in fondo (ON CONFLICT…, RETURNING…). Le righe si dividono in blocchi
// per restare sotto il limite di 65535 parametri di PostgreSQL.
export async function inserisciRighe(
  db: Esecutore, tabella: string, colonne: string[], valori: unknown[][], coda = "",
): Promise<Riga[]> {
  const risultati: Riga[] = [];
  const perBlocco = Math.max(1, Math.floor(60_000 / colonne.length));
  for (let inizio = 0; inizio < valori.length; inizio += perBlocco) {
    const blocco = valori.slice(inizio, inizio + perBlocco);
    const segnaposti = blocco.map((_, r) => `(${colonne.map((_, c) => `$${r * colonne.length + c + 1}`).join(", ")})`);
    const sql = `INSERT INTO ${tabella} (${colonne.join(", ")}) VALUES ${segnaposti.join(", ")} ${coda}`;
    risultati.push(...(await db.query(sql, blocco.flat())).rows);
  }
  return risultati;
}
