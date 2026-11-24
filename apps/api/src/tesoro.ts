import type { Monete, OggettoTesoro, Tesoro } from "@dnd/regole/api.ts";
import { riga, righe, transazione, type Esecutore, type Riga } from "./db.ts";
import { ErroreRichiesta } from "./errori.ts";

// Tesoro comune del party. Ogni operazione è una sola istruzione controllata dal database
// (CHECK >= 0, qta >= prelievo): due prelievi contemporanei non portano mai il tesoro sotto zero.
// Il client cambia la scheda del personaggio solo dopo la risposta positiva.

const TAGLI = ["mr", "ma", "me", "mo", "mp"] as const;
const MOVIMENTI = 50;
const NOMI_MONETE: Record<keyof Monete, string> = { mp: "mp", mo: "mo", me: "me", ma: "ma", mr: "mr" };

const nomeNelParty = `(
  SELECT CASE WHEN pm.ruolo = 'master' THEN 'Master' ELSE coalesce(nullif(pe.nome, ''), u.username) END
  FROM utenti u LEFT JOIN party_membri pm ON pm.utente_id = u.id AND pm.party_id = mv.party_id
    LEFT JOIN personaggi pe ON pe.id = pm.personaggio_id
  WHERE u.id = mv.utente_id)`;

const oggettoDaRiga = (r: Riga): OggettoTesoro => ({
  id: Number(r.id), nome: String(r.nome), qta: Number(r.qta), peso: Number(r.peso),
  ...(r.consumabile ? { consumabile: true, consumoGiornaliero: Number(r.consumo_giornaliero) } : {}),
});

export async function leggiTesoro(db: Esecutore, partyId: number): Promise<Tesoro> {
  const [monete, oggetti, movimenti] = await Promise.all([
    riga(db, "SELECT mr, ma, me, mo, mp FROM party_monete WHERE party_id = $1", [partyId]),
    righe(db, "SELECT * FROM party_oggetti WHERE party_id = $1 ORDER BY nome, id", [partyId]),
    righe(db, `SELECT mv.id, mv.descrizione, mv.creato, ${nomeNelParty} AS chi FROM party_tesoro_movimenti mv
      WHERE mv.party_id = $1 ORDER BY mv.id DESC LIMIT ${MOVIMENTI}`, [partyId]),
  ]);
  return {
    monete: Object.fromEntries(TAGLI.map(k => [k, Number(monete?.[k] ?? 0)])) as Monete,
    oggetti: oggetti.map(oggettoDaRiga),
    movimenti: movimenti.map(r => ({
      id: Number(r.id), chi: String(r.chi ?? "—"), descrizione: String(r.descrizione), creato: new Date(r.creato as string).toISOString(),
    })),
  };
}

const registra = (db: Esecutore, partyId: number, utenteId: number, descrizione: string) =>
  db.query("INSERT INTO party_tesoro_movimenti (party_id, utente_id, descrizione) VALUES ($1, $2, $3)", [partyId, utenteId, descrizione]);

const testoMonete = (delta: Partial<Monete>) =>
  (["mp", "mo", "me", "ma", "mr"] as const).filter(k => delta[k]).map(k => `${Math.abs(delta[k]!)} ${NOMI_MONETE[k]}`).join(", ");

// Variazione delle monete dal corpo: interi, tutti dello stesso segno (o si mette o si prende).
export function deltaMoneteDa(v: unknown): Partial<Monete> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) throw new ErroreRichiesta(400, "Monete non valide");
  const delta: Partial<Monete> = {};
  for (const [k, n] of Object.entries(v)) {
    if (!(TAGLI as readonly string[]).includes(k) || !Number.isInteger(n) || Math.abs(n as number) > 1_000_000) {
      throw new ErroreRichiesta(400, "Monete non valide");
    }
    if (n !== 0) delta[k as keyof Monete] = n as number;
  }
  const valori = Object.values(delta);
  if (valori.length === 0 || !(valori.every(n => n > 0) || valori.every(n => n < 0))) {
    throw new ErroreRichiesta(400, "Indica quante monete mettere o prendere");
  }
  return delta;
}

export async function cambiaMoneteTesoro(db: Esecutore, partyId: number, utenteId: number, delta: Partial<Monete>): Promise<Monete> {
  return transazione(db, async t => {
    await t.query("INSERT INTO party_monete (party_id) VALUES ($1) ON CONFLICT DO NOTHING", [partyId]);
    let r: Riga | undefined;
    try {
      r = await riga(t, `UPDATE party_monete SET ${TAGLI.map((k, i) => `${k} = ${k} + $${i + 2}`).join(", ")}
        WHERE party_id = $1 RETURNING mr, ma, me, mo, mp`, [partyId, ...TAGLI.map(k => delta[k] ?? 0)]);
    } catch (e) {
      if ((e as { code?: string }).code === "23514") throw new ErroreRichiesta(409, "Nel tesoro non ci sono abbastanza monete");
      throw e;
    }
    const prende = Object.values(delta).some(n => n < 0);
    await registra(t, partyId, utenteId, `${prende ? "ha preso" : "ha messo"} ${testoMonete(delta)}`);
    return Object.fromEntries(TAGLI.map(k => [k, Number(r![k])])) as Monete;
  });
}

// Oggetto dal corpo della richiesta (i campi di uno dello Zaino).
export function oggettoDa(corpo: Record<string, unknown>): Omit<OggettoTesoro, "id"> {
  const { nome, qta, peso, consumabile, consumoGiornaliero } = corpo;
  const n = typeof nome === "string" ? nome.trim() : "";
  if (n.length < 1 || n.length > 120) throw new ErroreRichiesta(400, "Il nome dell'oggetto deve avere da 1 a 120 caratteri");
  if (!Number.isInteger(qta) || (qta as number) < 1 || (qta as number) > 100_000) throw new ErroreRichiesta(400, "Quantità non valida");
  const p = peso === undefined ? 0 : peso;
  if (typeof p !== "number" || !Number.isFinite(p) || p < 0 || p > 10_000) throw new ErroreRichiesta(400, "Peso non valido");
  const consumo = typeof consumoGiornaliero === "number" && Number.isFinite(consumoGiornaliero) ? Math.max(0, consumoGiornaliero) : 0;
  return { nome: n, qta: qta as number, peso: p, ...(consumabile === true ? { consumabile: true, consumoGiornaliero: consumo } : {}) };
}

// Mette un oggetto nel tesoro: si somma a uno uguale (nome, peso, provvista), altrimenti è una voce nuova.
export async function mettiOggetto(db: Esecutore, partyId: number, utenteId: number, o: Omit<OggettoTesoro, "id">): Promise<number> {
  return transazione(db, async t => {
    const uguale = await riga(t, `
      UPDATE party_oggetti SET qta = qta + $5, aggiornato = now()
      WHERE id = (SELECT id FROM party_oggetti WHERE party_id = $1 AND lower(nome) = lower($2) AND peso = $3 AND consumabile = $4
        ORDER BY id LIMIT 1 FOR UPDATE)
      RETURNING id`, [partyId, o.nome, o.peso, !!o.consumabile, o.qta]);
    const id = uguale ? Number(uguale.id) : Number((await riga(t, `
      INSERT INTO party_oggetti (party_id, nome, qta, peso, consumabile, consumo_giornaliero) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [partyId, o.nome, o.qta, o.peso, !!o.consumabile, o.consumoGiornaliero ?? 0]))!.id);
    await registra(t, partyId, utenteId, `ha messo ${o.qta}× ${o.nome}`);
    return id;
  });
}

// Prende `qta` unità di un oggetto: restituisce ciò che è stato preso. 404 se l'oggetto non c'è più,
// 409 se ne resta meno di quanto chiesto (un altro l'ha preso nel frattempo).
export async function prendiOggetto(
  db: Esecutore, partyId: number, utenteId: number, id: number, qta: number, verbo = "ha preso",
): Promise<Omit<OggettoTesoro, "id">> {
  return transazione(db, async t => {
    const r = await riga(t, "SELECT * FROM party_oggetti WHERE party_id = $1 AND id = $2 FOR UPDATE", [partyId, id]);
    if (!r) throw new ErroreRichiesta(404, "Questo oggetto non è più nel tesoro");
    if (Number(r.qta) < qta) throw new ErroreRichiesta(409, `Nel tesoro ne restano solo ${Number(r.qta)}`);
    if (Number(r.qta) === qta) await t.query("DELETE FROM party_oggetti WHERE id = $1", [id]);
    else await t.query("UPDATE party_oggetti SET qta = qta - $2, aggiornato = now() WHERE id = $1", [id, qta]);
    const oggetto = oggettoDaRiga(r);
    await registra(t, partyId, utenteId, `${verbo} ${qta}× ${oggetto.nome}`);
    return {
      nome: oggetto.nome, qta, peso: oggetto.peso,
      ...(oggetto.consumabile ? { consumabile: true, consumoGiornaliero: oggetto.consumoGiornaliero } : {}),
    };
  });
}
