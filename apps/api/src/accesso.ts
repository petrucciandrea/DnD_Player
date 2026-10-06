import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Utente } from "@dnd/regole/api.ts";
import { riga, type Esecutore, type Riga } from "./db.ts";

// Utenti e sessioni. Le password sono salvate solo come hash scrypt; delle sessioni si conserva
// solo l'impronta SHA-256 del token, che resta nel cookie del browser.

export const DURATA_SESSIONE = 30 * 24 * 60 * 60 * 1000; // 30 giorni
export const LUNGHEZZA_MINIMA_PASSWORD = 8;
const USERNAME_VALIDO = /^[a-z0-9._-]{3,30}$/;

// scrypt asincrono: il calcolo (voluto lento) non blocca le altre richieste.
const scryptAsincrono = promisify(scrypt) as (password: string, sale: string, lunghezza: number) => Promise<Buffer>;

const normalizzaUsername = (username: string) => username.trim().toLowerCase();
const impronta = (token: string) => createHash("sha256").update(token).digest("hex");
const utenteDa = (r: Riga): Utente => ({ id: Number(r.id), username: String(r.username) });

export async function hashPassword(password: string, sale = randomBytes(16).toString("hex")): Promise<string> {
  return `scrypt$${sale}$${(await scryptAsincrono(password, sale, 64)).toString("hex")}`;
}

async function passwordCorretta(password: string, hash: string): Promise<boolean> {
  const [schema, sale, atteso] = hash.split("$");
  if (schema !== "scrypt" || !sale || !atteso) return false;
  const calcolato = await scryptAsincrono(password, sale, 64);
  const salvato = Buffer.from(atteso, "hex");
  return salvato.length === calcolato.length && timingSafeEqual(salvato, calcolato);
}

// Messaggi d'errore per l'utente, oppure null se il valore va bene.
export const erroreUsername = (username: string): string | null =>
  USERNAME_VALIDO.test(normalizzaUsername(username))
    ? null
    : "Lo username deve avere da 3 a 30 caratteri tra lettere, numeri, punto, trattino e trattino basso.";

export const errorePassword = (password: string): string | null =>
  password.length >= LUNGHEZZA_MINIMA_PASSWORD ? null : `La password deve avere almeno ${LUNGHEZZA_MINIMA_PASSWORD} caratteri.`;

export const erroreRegistrazione = (username: string, password: string) => erroreUsername(username) ?? errorePassword(password);

// Crea l'utente senza controllare le regole di registrazione (le applica l'API).
// null se lo username è già preso.
export async function creaUtente(db: Esecutore, username: string, password: string): Promise<Utente | null> {
  const r = await riga(db, `
    INSERT INTO utenti (username, hash) VALUES ($1, $2) ON CONFLICT (username) DO NOTHING RETURNING id, username
  `, [normalizzaUsername(username), await hashPassword(password)]);
  return r ? utenteDa(r) : null;
}

export async function verificaCredenziali(db: Esecutore, username: string, password: string): Promise<Utente | null> {
  const r = await riga(db, "SELECT id, username, hash FROM utenti WHERE username = $1", [normalizzaUsername(username)]);
  if (!r) {
    await hashPassword(password); // stesso tempo di risposta di una password sbagliata
    return null;
  }
  return (await passwordCorretta(password, String(r.hash))) ? utenteDa(r) : null;
}

export async function passwordDiUtente(db: Esecutore, utenteId: number, password: string): Promise<boolean> {
  const r = await riga(db, "SELECT hash FROM utenti WHERE id = $1", [utenteId]);
  return r !== undefined && passwordCorretta(password, String(r.hash));
}

// Senza controlli di validità (li applica l'API). null se lo username è già di un altro utente.
export async function cambiaUsername(db: Esecutore, utenteId: number, username: string): Promise<Utente | null> {
  const nome = normalizzaUsername(username);
  const occupato = await riga(db, "SELECT 1 FROM utenti WHERE username = $1 AND id <> $2", [nome, utenteId]);
  if (occupato) return null;
  try {
    await db.query("UPDATE utenti SET username = $1 WHERE id = $2", [nome, utenteId]);
  } catch (errore) {
    if ((errore as { code?: string }).code === "23505") return null; // preso nel frattempo da un altro
    throw errore;
  }
  return { id: utenteId, username: nome };
}

// Cambia la password e chiude le sessioni degli altri dispositivi: resta aperta solo `tokenAttuale`.
export async function cambiaPassword(db: Esecutore, utenteId: number, password: string, tokenAttuale: string) {
  await db.query("UPDATE utenti SET hash = $1 WHERE id = $2", [await hashPassword(password), utenteId]);
  await db.query("DELETE FROM sessioni WHERE utente_id = $1 AND token <> $2", [utenteId, impronta(tokenAttuale)]);
}

export async function apriSessione(db: Esecutore, utenteId: number, ora = Date.now()): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.query("DELETE FROM sessioni WHERE scadenza <= $1", [new Date(ora)]);
  await db.query("INSERT INTO sessioni (token, utente_id, scadenza) VALUES ($1, $2, $3)",
    [impronta(token), utenteId, new Date(ora + DURATA_SESSIONE)]);
  return token;
}

export async function leggiSessione(db: Esecutore, token: string, ora = Date.now()): Promise<Utente | null> {
  const r = await riga(db, `
    SELECT u.id, u.username FROM sessioni s JOIN utenti u ON u.id = s.utente_id
    WHERE s.token = $1 AND s.scadenza > $2
  `, [impronta(token), new Date(ora)]);
  return r ? utenteDa(r) : null;
}

export async function chiudiSessione(db: Esecutore, token: string) {
  await db.query("DELETE FROM sessioni WHERE token = $1", [impronta(token)]);
}
