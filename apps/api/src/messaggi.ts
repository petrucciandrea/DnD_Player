import type { MessaggiParty, MessaggioParty, RuoloParty, TiroCondiviso } from "@dnd/regole/api.ts";
import { riga, righe, type Esecutore, type Riga } from "./db.ts";
import { ErroreRichiesta } from "./errori.ts";

// Chat del party. Un utente vede i messaggi di gruppo e i privati che ha scritto o ricevuto.
// Il nome dell'autore si ricava in lettura (personaggio nel party, "Master" o username), non si copia nel messaggio.

export const LUNGHEZZA_MESSAGGIO = 2000;
export const MESSAGGI_PER_PAGINA = 100;

const SQL_MESSAGGI = `
  SELECT m.id, m.autore_id, m.destinatario_id, m.tipo, m.testo, m.tiro, m.creato, u.username, pm.ruolo, pe.nome AS personaggio_nome
  FROM party_messaggi m
    JOIN utenti u ON u.id = m.autore_id
    LEFT JOIN party_membri pm ON pm.party_id = m.party_id AND pm.utente_id = m.autore_id
    LEFT JOIN personaggi pe ON pe.id = pm.personaggio_id
  WHERE m.party_id = $1 AND (m.destinatario_id IS NULL OR m.destinatario_id = $2 OR m.autore_id = $2)`;

function messaggioDaRiga(r: Riga): MessaggioParty {
  const ruolo = (r.ruolo ?? null) as RuoloParty | null;
  const autore = ruolo === "master" ? "Master" : ruolo === "giocatore" ? String(r.personaggio_nome || r.username) : String(r.username);
  return {
    id: Number(r.id), autoreId: Number(r.autore_id), autore, ruoloAutore: ruolo,
    destinatarioId: r.destinatario_id === null ? null : Number(r.destinatario_id),
    tipo: r.tipo as MessaggioParty["tipo"], testo: String(r.testo), tiro: (r.tiro ?? null) as TiroCondiviso | null,
    creato: new Date(r.creato as string).toISOString(),
  };
}

// Con `dopo` i messaggi successivi (in ordine), con `prima` la pagina precedente, senza nessuno dei due gli ultimi.
export async function leggiMessaggi(
  db: Esecutore, partyId: number, utenteId: number, cursore: { dopo?: number; prima?: number },
): Promise<MessaggiParty> {
  const valori: unknown[] = [partyId, utenteId, MESSAGGI_PER_PAGINA];
  let sql: string;
  if (cursore.dopo !== undefined) {
    valori.push(cursore.dopo);
    sql = `${SQL_MESSAGGI} AND m.id > $4 ORDER BY m.id LIMIT $3`;
  } else {
    if (cursore.prima !== undefined) valori.push(cursore.prima);
    sql = `SELECT * FROM (${SQL_MESSAGGI} ${cursore.prima !== undefined ? "AND m.id < $4" : ""} ORDER BY m.id DESC LIMIT $3) x ORDER BY id`;
  }
  const [messaggi, letture] = await Promise.all([
    righe(db, sql, valori),
    righe(db, "SELECT con_utente_id, ultimo FROM party_letture WHERE party_id = $1 AND utente_id = $2", [partyId, utenteId]),
  ]);
  return {
    messaggi: messaggi.map(messaggioDaRiga),
    letture: Object.fromEntries(letture.map(r => [Number(r.con_utente_id), Number(r.ultimo)])),
  };
}

export async function scriviMessaggio(
  db: Esecutore, partyId: number, autoreId: number, contenuto: { testo: string; destinatarioId: number | null; tiro?: TiroCondiviso },
): Promise<number> {
  const r = await riga(db, `
    INSERT INTO party_messaggi (party_id, autore_id, destinatario_id, tipo, testo, tiro) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
  [partyId, autoreId, contenuto.destinatarioId, contenuto.tiro ? "tiro" : "testo", contenuto.testo, contenuto.tiro ?? null]);
  return Number(r!.id);
}

// Segna letta una conversazione fino al messaggio `fino` (non si torna mai indietro).
export async function segnaLetto(db: Esecutore, partyId: number, utenteId: number, conUtenteId: number, fino: number) {
  await db.query(`
    INSERT INTO party_letture (party_id, utente_id, con_utente_id, ultimo) VALUES ($1, $2, $3, $4)
    ON CONFLICT (party_id, utente_id, con_utente_id) DO UPDATE SET ultimo = GREATEST(party_letture.ultimo, EXCLUDED.ultimo)`,
  [partyId, utenteId, conUtenteId, fino]);
}

// Messaggi degli altri non ancora letti, per party: SQL da usare come sottoquery con p.id e $1 = utente.
export const SQL_NON_LETTI = `
  (SELECT count(*) FROM party_messaggi mm
    LEFT JOIN party_letture l ON l.party_id = mm.party_id AND l.utente_id = $1
      AND l.con_utente_id = CASE WHEN mm.destinatario_id IS NULL THEN 0 ELSE mm.autore_id END
    WHERE mm.party_id = p.id AND mm.autore_id <> $1 AND (mm.destinatario_id IS NULL OR mm.destinatario_id = $1)
      AND mm.id > coalesce(l.ultimo, 0))`;

const MASSIMO_DADI = 40;
const MODALITA = new Set(["normale", "vantaggio", "svantaggio"]);
const intero = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
const testoBreve = (v: unknown, max: number): v is string => typeof v === "string" && v.length <= max;

// Un tiro condiviso arriva dal client: se ne controlla la forma e si tengono solo i campi noti.
export function tiroDa(v: unknown): TiroCondiviso {
  const errore = () => new ErroreRichiesta(400, "Tiro non valido");
  if (typeof v !== "object" || v === null || Array.isArray(v)) throw errore();
  const t = v as Record<string, unknown>;
  const { titolo, descrizione, dadi, tiri, modalita, bonus, totale, presagio } = t;
  if (!testoBreve(titolo, 200) || !titolo.trim()) throw errore();
  if (descrizione !== undefined && !testoBreve(descrizione, 500)) throw errore();
  if (!Array.isArray(dadi) || dadi.length < 1 || dadi.length > MASSIMO_DADI) throw errore();
  if (!Array.isArray(tiri) || tiri.length < 1 || tiri.length > MASSIMO_DADI || !tiri.every(n => intero(n, 0, 10_000))) throw errore();
  const dadiPuliti = dadi.map(d => {
    const x = (typeof d === "object" && d !== null ? d : {}) as Record<string, unknown>;
    if (!testoBreve(x.etichetta, 60) || !intero(x.facce, 2, 1000)) throw errore();
    return { etichetta: x.etichetta, facce: x.facce };
  });
  if (typeof modalita !== "string" || !MODALITA.has(modalita) || !intero(bonus, -100, 100) || !intero(totale, -1000, 100_000)) throw errore();
  return {
    titolo: titolo.trim(), ...(descrizione ? { descrizione } : {}), dadi: dadiPuliti, tiri: tiri as number[],
    modalita: modalita as TiroCondiviso["modalita"], bonus, totale, ...(presagio === true ? { presagio: true } : {}),
  };
}

// L'utente Master del party.
export async function masterDel(db: Esecutore, partyId: number): Promise<number> {
  const r = await riga(db, "SELECT utente_id FROM party_membri WHERE party_id = $1 AND ruolo = 'master'", [partyId]);
  return Number(r!.utente_id);
}
