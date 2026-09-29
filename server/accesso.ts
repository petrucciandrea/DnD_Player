import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

// Utenti e sessioni. Ogni utente gioca un personaggio (l'id della riga in `personaggi`).
// Le password sono salvate solo come hash scrypt; delle sessioni si conserva solo l'impronta
// SHA-256 del token, che resta nel cookie del browser.

export interface Utente {
  username: string;
  personaggio: string;
}

export const DURATA_SESSIONE = 30 * 24 * 60 * 60 * 1000; // 30 giorni

// Creati insieme all'archivio, se non esistono già.
const UTENTI_INIZIALI = [
  {
    username: "alan",
    hash: "scrypt$7b8aa50e792d4d58625b54e9f0157a30$5975e5f2dee28f94492f4565cd98cd9c859eee83c19ec50fd916d7abaeb50ac79dcc121a7ce76fe6dc8e2dec20a2c1a3a27574aaf8223f85fbd7a7db0da66aac",
    personaggio: "alston",
  },
];

export function preparaAccesso(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS utenti (
      username TEXT PRIMARY KEY,
      hash TEXT NOT NULL,
      personaggio TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessioni (
      token TEXT PRIMARY KEY,
      username TEXT NOT NULL REFERENCES utenti(username) ON DELETE CASCADE,
      scadenza INTEGER NOT NULL
    );
  `);
  const inserisci = db.prepare("INSERT OR IGNORE INTO utenti (username, hash, personaggio) VALUES (?, ?, ?)");
  for (const u of UTENTI_INIZIALI) inserisci.run(u.username, u.hash, u.personaggio);
}

const normalizzaUsername = (username: string) => username.trim().toLowerCase();
const impronta = (token: string) => createHash("sha256").update(token).digest("hex");

export const hashPassword = (password: string, sale = randomBytes(16).toString("hex")) =>
  `scrypt$${sale}$${scryptSync(password, sale, 64).toString("hex")}`;

function passwordCorretta(password: string, hash: string): boolean {
  const [schema, sale, atteso] = hash.split("$");
  if (schema !== "scrypt" || !sale || !atteso) return false;
  const calcolato = scryptSync(password, sale, 64);
  const salvato = Buffer.from(atteso, "hex");
  return salvato.length === calcolato.length && timingSafeEqual(salvato, calcolato);
}

export function creaUtente(db: DatabaseSync, username: string, password: string, personaggio: string) {
  db.prepare("INSERT INTO utenti (username, hash, personaggio) VALUES (?, ?, ?)")
    .run(normalizzaUsername(username), hashPassword(password), personaggio);
}

export function verificaCredenziali(db: DatabaseSync, username: string, password: string): Utente | null {
  const riga = db.prepare("SELECT username, hash, personaggio FROM utenti WHERE username = ?").get(normalizzaUsername(username));
  if (!riga) {
    hashPassword(password); // stesso tempo di risposta di una password sbagliata
    return null;
  }
  if (!passwordCorretta(password, String(riga.hash))) return null;
  return { username: String(riga.username), personaggio: String(riga.personaggio) };
}

export function apriSessione(db: DatabaseSync, username: string, ora = Date.now()): string {
  const token = randomBytes(32).toString("base64url");
  db.prepare("DELETE FROM sessioni WHERE scadenza <= ?").run(ora);
  db.prepare("INSERT INTO sessioni (token, username, scadenza) VALUES (?, ?, ?)")
    .run(impronta(token), username, ora + DURATA_SESSIONE);
  return token;
}

export function leggiSessione(db: DatabaseSync, token: string, ora = Date.now()): Utente | null {
  const riga = db.prepare(`
    SELECT u.username, u.personaggio FROM sessioni s JOIN utenti u ON u.username = s.username
    WHERE s.token = ? AND s.scadenza > ?
  `).get(impronta(token), ora);
  return riga ? { username: String(riga.username), personaggio: String(riga.personaggio) } : null;
}

export function chiudiSessione(db: DatabaseSync, token: string) {
  db.prepare("DELETE FROM sessioni WHERE token = ?").run(impronta(token));
}
