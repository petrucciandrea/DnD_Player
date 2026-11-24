import { randomInt } from "node:crypto";
import type { DettaglioParty, MembroParty, RiassuntoParty, RiepilogoPersonaggioParty, RuoloParty } from "@dnd/regole/api.ts";
import { derivate } from "@dnd/regole/regole.ts";
import type { CharacterData } from "@dnd/regole/tipi.ts";
import { riga, righe, transazione, type Esecutore } from "./db.ts";
import { ErroreRichiesta } from "./errori.ts";
import { SQL_NON_LETTI } from "./messaggi.ts";
import { componiMolti } from "./personaggi.ts";

// Party: il Master lo crea e riceve un codice d'invito; i giocatori entrano con il codice e un loro personaggio.
// Chi non è membro riceve 404 (non scopre che il party esiste); un giocatore che chiede un'azione del Master 403.

// Niente caratteri che si confondono (0/O, 1/I/L): il codice si detta a voce o si copia a mano.
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const LUNGHEZZA_CODICE = 8;
export const LUNGHEZZA_NOME = 60;

export const nuovoCodice = () => Array.from({ length: LUNGHEZZA_CODICE }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");
export const normalizzaCodice = (codice: string) => codice.toUpperCase().replace(/[\s-]/g, "");
export const codiceLeggibile = (codice: string) => `${codice.slice(0, 4)}-${codice.slice(4)}`;

export interface Membro {
  ruolo: RuoloParty;
  personaggioId: number | null;
}

const errorePg = (e: unknown) => e as { code?: string; constraint?: string };

// Il ruolo dell'utente nel party, oppure 404 se non ne fa parte (o il party non esiste).
export async function membroDi(db: Esecutore, partyId: number, utenteId: number): Promise<Membro> {
  const r = await riga(db, "SELECT ruolo, personaggio_id FROM party_membri WHERE party_id = $1 AND utente_id = $2", [partyId, utenteId]);
  if (!r) throw new ErroreRichiesta(404, "Party inesistente");
  return { ruolo: r.ruolo as RuoloParty, personaggioId: r.personaggio_id === null ? null : Number(r.personaggio_id) };
}

export function richiediMaster(membro: Membro) {
  if (membro.ruolo !== "master") throw new ErroreRichiesta(403, "Solo il Master può farlo");
}

export async function creaParty(db: Esecutore, utenteId: number, nome: string): Promise<{ id: number; codice: string }> {
  return transazione(db, async t => {
    // Un codice già usato (molto raro) non inserisce nulla: se ne prova un altro.
    for (;;) {
      const codice = nuovoCodice();
      const r = await riga(t, "INSERT INTO party (nome, codice) VALUES ($1, $2) ON CONFLICT (codice) DO NOTHING RETURNING id", [nome, codice]);
      if (!r) continue;
      const id = Number(r.id);
      await t.query("INSERT INTO party_membri (party_id, utente_id, ruolo) VALUES ($1, $2, 'master')", [id, utenteId]);
      return { id, codice: codiceLeggibile(codice) };
    }
  });
}

export async function rigeneraCodice(db: Esecutore, partyId: number): Promise<string> {
  for (;;) {
    const codice = nuovoCodice();
    try {
      await db.query("UPDATE party SET codice = $2 WHERE id = $1", [partyId, codice]);
      return codiceLeggibile(codice);
    } catch (e) {
      if (errorePg(e).code !== "23505") throw e;
    }
  }
}

export const rinominaParty = async (db: Esecutore, partyId: number, nome: string) => {
  await db.query("UPDATE party SET nome = $2 WHERE id = $1", [partyId, nome]);
};

export const sciogliParty = async (db: Esecutore, partyId: number) => {
  await db.query("DELETE FROM party WHERE id = $1", [partyId]);
};

// Entra nel party del codice con un personaggio dell'utente. Restituisce l'id del party.
export async function entraNelParty(db: Esecutore, utenteId: number, codice: string, personaggioId: number): Promise<number> {
  const r = await riga(db, `
    SELECT (SELECT id FROM party WHERE codice = $1) AS party_id,
      EXISTS (SELECT 1 FROM personaggi WHERE id = $2 AND utente_id = $3) AS mio`, [normalizzaCodice(codice), personaggioId, utenteId]);
  if (!r?.mio) throw new ErroreRichiesta(404, "Personaggio inesistente");
  if (r.party_id === null) throw new ErroreRichiesta(404, "Codice d'invito non valido");
  const partyId = Number(r.party_id);
  try {
    await db.query(
      "INSERT INTO party_membri (party_id, utente_id, ruolo, personaggio_id) VALUES ($1, $2, 'giocatore', $3)",
      [partyId, utenteId, personaggioId]);
  } catch (e) {
    const { code, constraint } = errorePg(e);
    if (code !== "23505") throw e;
    throw new ErroreRichiesta(409, constraint === "party_membri_pkey"
      ? "Fai già parte di questo party"
      : "Questo personaggio è già in un party");
  }
  return partyId;
}

// Toglie un giocatore (uscita o espulsione). Il Master non esce: scioglie il party.
export async function togliMembro(db: Esecutore, partyId: number, utenteId: number): Promise<boolean> {
  const r = await db.query("DELETE FROM party_membri WHERE party_id = $1 AND utente_id = $2 AND ruolo = 'giocatore'", [partyId, utenteId]);
  return (r.rowCount ?? 0) > 0;
}

export const elencoParty = async (db: Esecutore, utenteId: number): Promise<RiassuntoParty[]> =>
  (await righe(db, `
    SELECT p.id, p.nome, m.ruolo, m.personaggio_id, pe.nome AS personaggio_nome,
      (SELECT count(*) FROM party_membri x WHERE x.party_id = p.id) AS membri, ${SQL_NON_LETTI} AS non_letti
    FROM party_membri m JOIN party p ON p.id = m.party_id LEFT JOIN personaggi pe ON pe.id = m.personaggio_id
    WHERE m.utente_id = $1 ORDER BY p.nome, p.id`, [utenteId]))
    .map(r => ({
      id: Number(r.id), nome: String(r.nome), ruolo: r.ruolo as RuoloParty,
      personaggio: r.personaggio_id === null ? null : { id: Number(r.personaggio_id), nome: String(r.personaggio_nome ?? "") },
      membri: Number(r.membri), nonLetti: Number(r.non_letti),
    }));

// Lo stato in gioco di un personaggio, calcolato dalla scheda: niente valori derivati salvati.
export function riepilogoPersonaggio(id: number, c: CharacterData): RiepilogoPersonaggioParty {
  const d = derivate(c);
  return {
    id, nome: c.info.nome, classe: c.info.classe, sottoclasse: c.info.sottoclasse, livello: c.info.livello, razza: c.info.razza,
    avatar: c.info.avatar,
    pf: c.combattimento.pfAttuali, pfMassimi: d.pfMassimiEffettivi, pfTemporanei: c.combattimento.pfTemporanei,
    ca: d.ca, condizioni: c.condizioni, indebolimento: c.indebolimento,
  };
}

export async function dettaglioParty(db: Esecutore, partyId: number, utenteId: number): Promise<DettaglioParty> {
  const membri = await righe(db, `
    SELECT p.nome AS party_nome, p.codice, m.utente_id, u.username, m.ruolo, m.personaggio_id
    FROM party p JOIN party_membri m ON m.party_id = p.id JOIN utenti u ON u.id = m.utente_id
    WHERE p.id = $1 ORDER BY m.ruolo = 'master' DESC, m.entrato, m.utente_id`, [partyId]);
  const io = membri.find(r => Number(r.utente_id) === utenteId);
  if (!io) throw new ErroreRichiesta(404, "Party inesistente");
  const schede = await componiMolti(db, membri.filter(r => r.personaggio_id !== null).map(r => Number(r.personaggio_id)));
  const ruolo = io.ruolo as RuoloParty;
  return {
    id: partyId,
    nome: String(io.party_nome),
    codice: ruolo === "master" ? codiceLeggibile(String(io.codice)) : null,
    membri: membri.map((r): MembroParty => {
      const pid = r.personaggio_id === null ? null : Number(r.personaggio_id);
      const scheda = pid === null ? undefined : schede.get(pid);
      return {
        utenteId: Number(r.utente_id), username: String(r.username), ruolo: r.ruolo as RuoloParty,
        personaggio: pid !== null && scheda ? riepilogoPersonaggio(pid, scheda) : null,
      };
    }),
    io: { utenteId, ruolo, personaggioId: io.personaggio_id === null ? null : Number(io.personaggio_id) },
  };
}

export async function eMembro(db: Esecutore, partyId: number, utenteId: number): Promise<boolean> {
  return Boolean(await riga(db, "SELECT 1 FROM party_membri WHERE party_id = $1 AND utente_id = $2", [partyId, utenteId]));
}

// Il personaggio è di un giocatore di questo party?
export async function personaggioNelParty(db: Esecutore, partyId: number, personaggioId: number): Promise<boolean> {
  return Boolean(await riga(db, "SELECT 1 FROM party_membri WHERE party_id = $1 AND personaggio_id = $2", [partyId, personaggioId]));
}
