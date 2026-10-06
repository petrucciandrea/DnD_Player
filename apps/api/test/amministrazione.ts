import pg from "pg";

// Database per i test. Si usa solo DATABASE_URL_TEST (mai DATABASE_URL, che potrebbe essere quello di
// produzione); il predefinito è il Postgres di docker-compose.yml. L'utente deve poter creare database.
export const URL_TEST = process.env.DATABASE_URL_TEST ?? "postgres://dnd:dnd@localhost:5440/dnd";
export const DB_MODELLO = "dnd_test_modello";
export const PREFISSO = "dnd_test_x";

export function urlDatabase(nome: string) {
  const u = new URL(URL_TEST);
  u.pathname = `/${nome}`;
  return u.toString();
}

export async function eseguiComeAmministratore(...comandi: string[]) {
  const client = new pg.Client({ connectionString: URL_TEST });
  await client.connect();
  try {
    for (const sql of comandi) await client.query(sql);
  } finally {
    await client.end();
  }
}

export async function eliminaDatabaseDiProva() {
  const client = new pg.Client({ connectionString: URL_TEST });
  await client.connect();
  try {
    const { rows } = await client.query("SELECT datname FROM pg_database WHERE datname LIKE $1", [`${PREFISSO}%`]);
    for (const r of rows) await client.query(`DROP DATABASE IF EXISTS ${r.datname} WITH (FORCE)`);
  } finally {
    await client.end();
  }
}
