import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

// Utenti e sessioni. Le password sono salvate solo come hash scrypt; delle sessioni si conserva
// solo l'impronta SHA-256 del token, che resta nel cookie del browser.

export interface Utente {
  id: number;
  username: string;
}

export const DURATA_SESSIONE = 30 * 24 * 60 * 60 * 1000; // 30 giorni
export const LUNGHEZZA_MINIMA_PASSWORD = 8;
const USERNAME_VALIDO = /^[a-z0-9._-]{3,30}$/;

const normalizzaUsername = (username: string) => username.trim().toLowerCase();
const impronta = (token: string) => createHash("sha256").update(token).digest("hex");
const utenteDa = (r: Record<string, unknown>): Utente => ({ id: Number(r.id), username: String(r.username) });

export const hashPassword = (password: string, sale = randomBytes(16).toString("hex")) =>
  `scrypt$${sale}$${scryptSync(password, sale, 64).toString("hex")}`;

function passwordCorretta(password: string, hash: string): boolean {
  const [schema, sale, atteso] = hash.split("$");
  if (schema !== "scrypt" || !sale || !atteso) return false;
  const calcolato = scryptSync(password, sale, 64);
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
export function creaUtente(db: DatabaseSync, username: string, password: string): Utente | null {
  const nome = normalizzaUsername(username);
  const esito = db.prepare("INSERT OR IGNORE INTO utenti (username, hash, creato) VALUES (?, ?, ?)")
    .run(nome, hashPassword(password), new Date().toISOString());
  return esito.changes === 0 ? null : { id: Number(esito.lastInsertRowid), username: nome };
}

export function verificaCredenziali(db: DatabaseSync, username: string, password: string): Utente | null {
  const riga = db.prepare("SELECT id, username, hash FROM utenti WHERE username = ?").get(normalizzaUsername(username));
  if (!riga) {
    hashPassword(password); // stesso tempo di risposta di una password sbagliata
    return null;
  }
  return passwordCorretta(password, String(riga.hash)) ? utenteDa(riga) : null;
}

export function passwordDiUtente(db: DatabaseSync, utenteId: number, password: string): boolean {
  const riga = db.prepare("SELECT hash FROM utenti WHERE id = ?").get(utenteId);
  return riga !== undefined && passwordCorretta(password, String(riga.hash));
}

// Senza controlli di validità (li applica l'API). null se lo username è già di un altro utente.
export function cambiaUsername(db: DatabaseSync, utenteId: number, username: string): Utente | null {
  const nome = normalizzaUsername(username);
  const occupato = db.prepare("SELECT 1 FROM utenti WHERE username = ? AND id <> ?").get(nome, utenteId);
  if (occupato) return null;
  db.prepare("UPDATE utenti SET username = ? WHERE id = ?").run(nome, utenteId);
  return { id: utenteId, username: nome };
}

// Cambia la password e chiude le sessioni degli altri dispositivi: resta aperta solo `tokenAttuale`.
export function cambiaPassword(db: DatabaseSync, utenteId: number, password: string, tokenAttuale: string) {
  db.prepare("UPDATE utenti SET hash = ? WHERE id = ?").run(hashPassword(password), utenteId);
  db.prepare("DELETE FROM sessioni WHERE utente_id = ? AND token <> ?").run(utenteId, impronta(tokenAttuale));
}

export function apriSessione(db: DatabaseSync, utenteId: number, ora = Date.now()): string {
  const token = randomBytes(32).toString("base64url");
  db.prepare("DELETE FROM sessioni WHERE scadenza <= ?").run(ora);
  db.prepare("INSERT INTO sessioni (token, utente_id, scadenza) VALUES (?, ?, ?)")
    .run(impronta(token), utenteId, ora + DURATA_SESSIONE);
  return token;
}

export function leggiSessione(db: DatabaseSync, token: string, ora = Date.now()): Utente | null {
  const riga = db.prepare(`
    SELECT u.id, u.username FROM sessioni s JOIN utenti u ON u.id = s.utente_id
    WHERE s.token = ? AND s.scadenza > ?
  `).get(impronta(token), ora);
  return riga ? utenteDa(riga) : null;
}

export function chiudiSessione(db: DatabaseSync, token: string) {
  db.prepare("DELETE FROM sessioni WHERE token = ?").run(impronta(token));
}
