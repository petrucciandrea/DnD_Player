import type { CategoriaDiario, VoceDiario } from "@dnd/regole/api.ts";
import { riga, righe, type Esecutore, type Riga } from "./db.ts";
import { ErroreRichiesta } from "./errori.ts";

// Diario di campagna del party. Le modifiche usano la revisione come la scheda: chi salva
// una voce cambiata da un altro nel frattempo riceve 409 con la versione attuale.

export const CATEGORIE_DIARIO: CategoriaDiario[] = ["sessione", "png", "luogo", "missione", "altro"];
export const LUNGHEZZA_TITOLO = 200;
export const LUNGHEZZA_VOCE = 20_000;

// Nome nel party dell'utente nella colonna indicata: personaggio, "Master" o username.
const nomeNelParty = (colonna: string) => `(
  SELECT CASE WHEN pm.ruolo = 'master' THEN 'Master' ELSE coalesce(nullif(pe.nome, ''), u.username) END
  FROM utenti u LEFT JOIN party_membri pm ON pm.utente_id = u.id AND pm.party_id = d.party_id
    LEFT JOIN personaggi pe ON pe.id = pm.personaggio_id
  WHERE u.id = ${colonna})`;

const SQL_VOCI = `
  SELECT d.*, ${nomeNelParty("d.autore_id")} AS autore, ${nomeNelParty("d.aggiornato_da")} AS aggiornato_da_nome
  FROM party_diario d WHERE d.party_id = $1`;

const voceDaRiga = (r: Riga): VoceDiario => ({
  id: Number(r.id), titolo: String(r.titolo), testo: String(r.testo), categoria: r.categoria as CategoriaDiario,
  fissata: Boolean(r.fissata), autoreId: r.autore_id === null ? null : Number(r.autore_id),
  autore: String(r.autore ?? "—"), aggiornatoDa: String(r.aggiornato_da_nome ?? "—"), revisione: Number(r.revisione),
  creato: new Date(r.creato as string).toISOString(), aggiornato: new Date(r.aggiornato as string).toISOString(),
});

export interface DatiVoce {
  titolo: string;
  testo: string;
  categoria: CategoriaDiario;
  fissata?: boolean; // assente: resta com'è
}

// Campi di una voce dal corpo della richiesta.
export function datiVoceDa(corpo: Record<string, unknown>): DatiVoce {
  const { titolo, testo, categoria, fissata } = corpo;
  const t = typeof titolo === "string" ? titolo.trim() : "";
  if (t.length < 1 || t.length > LUNGHEZZA_TITOLO) throw new ErroreRichiesta(400, `Il titolo deve avere da 1 a ${LUNGHEZZA_TITOLO} caratteri`);
  if (typeof testo !== "string" || testo.length > LUNGHEZZA_VOCE) throw new ErroreRichiesta(400, `Il testo può avere al massimo ${LUNGHEZZA_VOCE} caratteri`);
  if (typeof categoria !== "string" || !CATEGORIE_DIARIO.includes(categoria as CategoriaDiario)) throw new ErroreRichiesta(400, "Categoria non valida");
  if (fissata !== undefined && typeof fissata !== "boolean") throw new ErroreRichiesta(400, "Fissata non valida");
  return { titolo: t, testo, categoria: categoria as CategoriaDiario, ...(fissata !== undefined ? { fissata } : {}) };
}

// Prima le voci fissate, poi le più recenti.
export const vociDiario = async (db: Esecutore, partyId: number): Promise<VoceDiario[]> =>
  (await righe(db, `${SQL_VOCI} ORDER BY d.fissata DESC, d.aggiornato DESC, d.id DESC`, [partyId])).map(voceDaRiga);

export async function voceDiario(db: Esecutore, partyId: number, id: number): Promise<VoceDiario | null> {
  const r = await riga(db, `${SQL_VOCI} AND d.id = $2`, [partyId, id]);
  return r ? voceDaRiga(r) : null;
}

export async function creaVoce(db: Esecutore, partyId: number, utenteId: number, v: DatiVoce): Promise<VoceDiario> {
  const r = await riga(db, `
    INSERT INTO party_diario (party_id, titolo, testo, categoria, fissata, autore_id, aggiornato_da)
    VALUES ($1, $2, $3, $4, $5, $6, $6) RETURNING id`, [partyId, v.titolo, v.testo, v.categoria, v.fissata ?? false, utenteId]);
  return (await voceDiario(db, partyId, Number(r!.id)))!;
}

export type EsitoModifica = { ok: true; voce: VoceDiario } | { ok: false; attuale: VoceDiario | null };

export async function modificaVoce(
  db: Esecutore, partyId: number, id: number, utenteId: number, v: DatiVoce, revisione: number,
): Promise<EsitoModifica> {
  const r = await riga(db, `
    UPDATE party_diario SET titolo = $4, testo = $5, categoria = $6, fissata = coalesce($7, fissata),
      aggiornato_da = $8, revisione = revisione + 1, aggiornato = now()
    WHERE party_id = $1 AND id = $2 AND revisione = $3 RETURNING id`,
  [partyId, id, revisione, v.titolo, v.testo, v.categoria, v.fissata ?? null, utenteId]);
  if (r) return { ok: true, voce: (await voceDiario(db, partyId, id))! };
  return { ok: false, attuale: await voceDiario(db, partyId, id) };
}

export const cancellaVoce = async (db: Esecutore, partyId: number, id: number) => {
  await db.query("DELETE FROM party_diario WHERE party_id = $1 AND id = $2", [partyId, id]);
};

// Versione del diario del party p: numero di voci e ultima modifica (una cancellazione cambia il numero).
export const SQL_VERSIONE_DIARIO =
  "(SELECT count(*) || ':' || coalesce(max(aggiornato)::text, '') FROM party_diario WHERE party_id = p.id)";
