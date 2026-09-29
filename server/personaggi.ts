import type { DatabaseSync, SQLOutputValue } from "node:sqlite";
import type {
  CategoriaNota, Caratteristica, CharacterData, CompetenzeAltre, EffettoAttivo, InventoryItem, NotaSessione, Spell, XPRecord,
} from "../src/tipi.ts";
import { CARATTERISTICHE } from "../src/regole.ts";
import { personaggioVuoto } from "../src/scheda.ts";
import {
  armaDaRiga, armaturaDaRiga, idArma, idArmatura, idIncantesimo, idPrivilegio, privilegioDaRiga, voceIncantesimo,
} from "./catalogo.ts";
import { transazione } from "./transazione.ts";

// Il client lavora con la scheda intera (CharacterData); nell'archivio è divisa in tabelle.
// `scomponi` la scrive, `componi` la ricostruisce unendo i cataloghi.

export interface RiassuntoPersonaggio {
  id: number;
  nome: string;
  classe: string;
  sottoclasse: string;
  livello: number;
  razza: string;
}

const testo = (v: unknown) => (typeof v === "string" ? v : v === null || v === undefined ? "" : String(v));
const intero = (v: unknown, def = 0) => (typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : def);
const numero = (v: unknown, def = 0) => (typeof v === "number" && Number.isFinite(v) ? v : def);
const flag = (v: unknown) => (v === true ? 1 : 0);
const vero = (v: SQLOutputValue) => v === 1;

// Tabelle figlie riscritte a ogni salvataggio.
const TABELLE_FIGLIE = [
  "personaggio_caratteristiche", "personaggio_abilita", "personaggio_slot", "personaggio_presagio",
  "personaggio_xp", "personaggio_oggetti", "personaggio_incantesimi", "personaggio_armi", "personaggio_privilegi",
  "personaggio_competenze", "personaggio_risorse", "personaggio_condizioni", "personaggio_effetti", "personaggio_note",
];

// Competenze diverse da abilità e TS: tipo nella tabella `personaggio_competenze` → campo di CompetenzeAltre.
const TIPI_COMPETENZA: [string, keyof CompetenzeAltre][] = [
  ["lingua", "lingue"], ["strumento", "strumenti"], ["arma", "armi"], ["armatura", "armature"],
];

// `c` deve essere già normalizzata con daJSON(); qui si convertono comunque i tipi dei singoli campi,
// perché la scheda arriva dal client.
export function scomponi(db: DatabaseSync, id: number, c: CharacterData, utenteId: number) {
  transazione(db, () => {
    for (const t of TABELLE_FIGLIE) db.prepare(`DELETE FROM ${t} WHERE personaggio_id = ?`).run(id);

    // Incantesimi, armi e privilegi: le voci si cercano (o si creano) nel catalogo per nome.
    const inserisciIncantesimo = db.prepare(
      "INSERT OR IGNORE INTO personaggio_incantesimi (personaggio_id, incantesimo_id, preparato, ordine) VALUES (?, ?, ?, ?)",
    );
    c.incantesimi.forEach((s, ordine) => {
      const nome = testo(s.nome).trim();
      if (!nome) return;
      const voce = { nome, livello: intero(s.livello), scuola: testo(s.scuola), tempo: testo(s.tempo), scheda: s.scheda };
      inserisciIncantesimo.run(id, idIncantesimo(db, voce, utenteId), flag(s.preparato), ordine);
    });
    const inserisciArma = db.prepare("INSERT OR IGNORE INTO personaggio_armi (personaggio_id, arma_id, ordine) VALUES (?, ?, ?)");
    c.armi.forEach((a, ordine) => {
      const nome = testo(a.nome).trim();
      if (!nome) return;
      const arma = {
        nome, dado: testo(a.dado), tipoDanno: testo(a.tipoDanno), proprieta: testo(a.proprieta), accurata: a.accurata === true,
        ...(a.dadoVersatile ? { dadoVersatile: testo(a.dadoVersatile) } : {}),
        ...(a.categoria === "semplice" || a.categoria === "guerra" ? { categoria: a.categoria } : {}),
        ...(a.distanza ? { distanza: true } : {}),
      };
      inserisciArma.run(id, idArma(db, arma, utenteId), ordine);
    });
    const inserisciPrivilegio = db.prepare(
      "INSERT OR IGNORE INTO personaggio_privilegi (personaggio_id, privilegio_id, ordine) VALUES (?, ?, ?)",
    );
    c.privilegi.forEach((p, ordine) => {
      const nome = testo(p.nome).trim();
      if (!nome) return;
      const privilegio = { nome, fonte: testo(p.fonte), descrizione: testo(p.descrizione) };
      inserisciPrivilegio.run(id, idPrivilegio(db, privilegio, utenteId), ordine);
    });

    const armaturaId = c.armatura && testo(c.armatura.nome).trim()
      ? idArmatura(db, { ...c.armatura, nome: testo(c.armatura.nome).trim() }, utenteId)
      : null;

    const competenza = db.prepare("INSERT OR IGNORE INTO personaggio_competenze (personaggio_id, tipo, nome, ordine) VALUES (?, ?, ?, ?)");
    for (const [tipo, campo] of TIPI_COMPETENZA) {
      c.competenzeAltre[campo].forEach((nome, ordine) => {
        if (testo(nome).trim()) competenza.run(id, tipo, testo(nome).trim(), ordine);
      });
    }

    const concentrazione = c.concentrazione
      ? db.prepare("SELECT id FROM incantesimi WHERE nome = ?").get(c.concentrazione)
      : undefined;
    const { info, combattimento: pf, monete, lore } = c;
    db.prepare(`
      UPDATE personaggi SET
        nome = :nome, classe = :classe, sottoclasse = :sottoclasse, livello = :livello, razza = :razza,
        background = :background, allineamento = :allineamento, giocatore = :giocatore, eta = :eta,
        altezza = :altezza, peso = :peso, occhi = :occhi, capelli = :capelli, carnagione = :carnagione,
        velocita = :velocita, taglia = :taglia, ispirazione = :ispirazione, indebolimento = :indebolimento, armatura_id = :armatura_id, scudo = :scudo,
        pf_attuali = :pf_attuali, pf_massimi = :pf_massimi, pf_temporanei = :pf_temporanei,
        dadi_vita_rimanenti = :dadi_vita_rimanenti, ts_morte_successi = :ts_morte_successi,
        ts_morte_fallimenti = :ts_morte_fallimenti, stabile = :stabile,
        concentrazione_id = :concentrazione_id, recupero_arcano_usato = :recupero_arcano_usato,
        mr = :mr, ma = :ma, me = :me, mo = :mo, mp = :mp, xp_totale = :xp_totale,
        tratti = :tratti, ideali = :ideali, legami = :legami, difetti = :difetti, background_bio = :background_bio
      WHERE id = :id
    `).run({
      id,
      nome: testo(info.nome), classe: testo(info.classe), sottoclasse: testo(info.sottoclasse),
      livello: intero(info.livello, 1), razza: testo(info.razza), background: testo(info.background),
      allineamento: testo(info.allineamento), giocatore: testo(info.giocatore), eta: intero(info.eta),
      altezza: testo(info.altezza), peso: testo(info.peso), occhi: testo(info.occhi), capelli: testo(info.capelli),
      carnagione: testo(info.carnagione), velocita: testo(info.velocita), taglia: testo(info.taglia) || "Media",
      ispirazione: flag(info.ispirazione), indebolimento: Math.max(0, Math.min(6, intero(c.indebolimento))), armatura_id: armaturaId, scudo: flag(c.scudo),
      pf_attuali: intero(pf.pfAttuali), pf_massimi: intero(pf.pfMassimi), pf_temporanei: intero(pf.pfTemporanei),
      dadi_vita_rimanenti: intero(pf.dadiVitaRimanenti), ts_morte_successi: intero(pf.tsMorte?.successi),
      ts_morte_fallimenti: intero(pf.tsMorte?.fallimenti), stabile: flag(pf.stabile),
      concentrazione_id: concentrazione ? Number(concentrazione.id) : null,
      recupero_arcano_usato: flag(c.recuperoArcanoUsato),
      mr: intero(monete.mr), ma: intero(monete.ma), me: intero(monete.me), mo: intero(monete.mo), mp: intero(monete.mp),
      xp_totale: intero(c.xp.totale),
      tratti: testo(lore.tratti), ideali: testo(lore.ideali), legami: testo(lore.legami),
      difetti: testo(lore.difetti), background_bio: testo(lore.backgroundBio),
    });

    const car = db.prepare("INSERT INTO personaggio_caratteristiche (personaggio_id, car, valore, comp_ts) VALUES (?, ?, ?, ?)");
    for (const k of CARATTERISTICHE) car.run(id, k, intero(c.caratteristiche[k].valore, 10), flag(c.caratteristiche[k].compTS));

    const abilita = db.prepare("INSERT OR IGNORE INTO personaggio_abilita (personaggio_id, abilita) VALUES (?, ?)");
    for (const a of c.competenzeAbilita) abilita.run(id, testo(a));

    const slot = db.prepare("INSERT INTO personaggio_slot (personaggio_id, livello, spesi) VALUES (?, ?, ?)");
    c.slotSpesi.forEach((spesi, i) => slot.run(id, i + 1, intero(spesi)));

    const presagio = db.prepare("INSERT INTO personaggio_presagio (personaggio_id, indice, valore, usato) VALUES (?, ?, ?, ?)");
    const { presagio: valori = [], usati = [] } = c.divinazione;
    valori.forEach((v, i) => presagio.run(id, i, intero(v), flag(usati[i])));

    const xp = db.prepare(
      "INSERT INTO personaggio_xp (personaggio_id, ordine, id_locale, data, valore, motivo) VALUES (?, ?, ?, ?, ?, ?)",
    );
    c.xp.storico.forEach((r, i) => xp.run(id, i, intero(r.id, i + 1), testo(r.data), intero(r.valore), testo(r.motivo)));

    const risorsa = db.prepare("INSERT OR IGNORE INTO personaggio_risorse (personaggio_id, risorsa, usati) VALUES (?, ?, ?)");
    for (const [nomeRisorsa, usati] of Object.entries(c.risorseUsate)) {
      if (intero(usati) > 0) risorsa.run(id, nomeRisorsa, intero(usati));
    }
    const condizione = db.prepare("INSERT OR IGNORE INTO personaggio_condizioni (personaggio_id, condizione, ordine) VALUES (?, ?, ?)");
    c.condizioni.forEach((nomeCondizione, i) => condizione.run(id, testo(nomeCondizione), i));
    const effetto = db.prepare("INSERT OR IGNORE INTO personaggio_effetti (personaggio_id, effetto, valore, ordine) VALUES (?, ?, ?, ?)");
    c.effetti.forEach((e, i) => effetto.run(id, testo(e.id), typeof e.valore === "number" ? intero(e.valore) : null, i));
    const nota = db.prepare(
      "INSERT INTO personaggio_note (personaggio_id, ordine, id_locale, data, categoria, titolo, testo, fatto) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    );
    c.note.forEach((n, i) => nota.run(id, i, intero(n.id, i + 1), testo(n.data), testo(n.categoria), testo(n.titolo), testo(n.testo), flag(n.fatto)));

    const oggetto = db.prepare(
      "INSERT INTO personaggio_oggetti (personaggio_id, ordine, id_locale, nome, qta, peso) VALUES (?, ?, ?, ?, ?, ?)",
    );
    c.inventario.forEach((o, i) => oggetto.run(id, i, intero(o.id, i + 1), testo(o.nome), intero(o.qta, 1), numero(o.peso)));
  });
}

export function componi(db: DatabaseSync, id: number): CharacterData | null {
  const p = db.prepare(`
    SELECT p.*, i.nome AS concentrazione_nome
    FROM personaggi p LEFT JOIN incantesimi i ON i.id = p.concentrazione_id
    WHERE p.id = ?
  `).get(id);
  if (!p) return null;
  const tutte = (sql: string) => db.prepare(sql).all(id);
  const c = personaggioVuoto();

  c.info = {
    nome: testo(p.nome), classe: testo(p.classe), sottoclasse: testo(p.sottoclasse), livello: Number(p.livello),
    razza: testo(p.razza), background: testo(p.background), allineamento: testo(p.allineamento),
    giocatore: testo(p.giocatore), eta: Number(p.eta), altezza: testo(p.altezza), peso: testo(p.peso),
    occhi: testo(p.occhi), capelli: testo(p.capelli), carnagione: testo(p.carnagione), velocita: testo(p.velocita),
    taglia: testo(p.taglia), ispirazione: vero(p.ispirazione),
  };
  c.indebolimento = Number(p.indebolimento);
  c.risorseUsate = Object.fromEntries(
    tutte("SELECT risorsa, usati FROM personaggio_risorse WHERE personaggio_id = ?").map(r => [testo(r.risorsa), Number(r.usati)]),
  );
  c.condizioni = tutte("SELECT condizione FROM personaggio_condizioni WHERE personaggio_id = ? ORDER BY ordine").map(r => testo(r.condizione));
  c.effetti = tutte("SELECT effetto, valore FROM personaggio_effetti WHERE personaggio_id = ? ORDER BY ordine").map((r): EffettoAttivo =>
    r.valore === null ? { id: testo(r.effetto) } : { id: testo(r.effetto), valore: Number(r.valore) });
  c.note = tutte("SELECT * FROM personaggio_note WHERE personaggio_id = ? ORDER BY ordine").map((r): NotaSessione => ({
    id: Number(r.id_locale), data: testo(r.data), categoria: testo(r.categoria) as CategoriaNota, titolo: testo(r.titolo),
    testo: testo(r.testo), fatto: vero(r.fatto),
  }));
  const armatura = p.armatura_id === null ? undefined : db.prepare("SELECT * FROM armature WHERE id = ?").get(p.armatura_id);
  c.armatura = armatura ? armaturaDaRiga(armatura) : null;
  c.scudo = vero(p.scudo);
  for (const [tipo, campo] of TIPI_COMPETENZA) {
    c.competenzeAltre[campo] = tutte(`SELECT nome FROM personaggio_competenze WHERE personaggio_id = ? AND tipo = '${tipo}' ORDER BY ordine`)
      .map(r => testo(r.nome));
  }
  for (const r of tutte("SELECT car, valore, comp_ts FROM personaggio_caratteristiche WHERE personaggio_id = ?")) {
    c.caratteristiche[testo(r.car) as Caratteristica] = { valore: Number(r.valore), compTS: vero(r.comp_ts) };
  }
  c.competenzeAbilita = tutte("SELECT abilita FROM personaggio_abilita WHERE personaggio_id = ? ORDER BY rowid")
    .map(r => testo(r.abilita));
  c.combattimento = {
    pfAttuali: Number(p.pf_attuali), pfMassimi: Number(p.pf_massimi), pfTemporanei: Number(p.pf_temporanei),
    dadiVitaRimanenti: Number(p.dadi_vita_rimanenti),
    tsMorte: { successi: Number(p.ts_morte_successi), fallimenti: Number(p.ts_morte_fallimenti) },
    stabile: vero(p.stabile),
  };
  c.concentrazione = p.concentrazione_nome === null ? null : testo(p.concentrazione_nome);
  const presagio = tutte("SELECT valore, usato FROM personaggio_presagio WHERE personaggio_id = ? ORDER BY indice");
  c.divinazione = { presagio: presagio.map(r => Number(r.valore)), usati: presagio.map(r => vero(r.usato)) };
  c.recuperoArcanoUsato = vero(p.recupero_arcano_usato);
  c.monete = { mr: Number(p.mr), ma: Number(p.ma), me: Number(p.me), mo: Number(p.mo), mp: Number(p.mp) };
  c.xp = {
    totale: Number(p.xp_totale),
    storico: tutte("SELECT * FROM personaggio_xp WHERE personaggio_id = ? ORDER BY ordine").map((r): XPRecord => ({
      id: Number(r.id_locale), data: testo(r.data), valore: Number(r.valore), motivo: testo(r.motivo),
    })),
  };
  c.armi = tutte(`
    SELECT a.* FROM personaggio_armi pa JOIN armi a ON a.id = pa.arma_id
    WHERE pa.personaggio_id = ? ORDER BY pa.ordine
  `).map(armaDaRiga);
  for (const r of tutte("SELECT livello, spesi FROM personaggio_slot WHERE personaggio_id = ?")) {
    const i = Number(r.livello) - 1;
    if (i >= 0 && i < 9) c.slotSpesi[i] = Number(r.spesi);
  }
  c.incantesimi = tutte(`
    SELECT i.*, pi.preparato FROM personaggio_incantesimi pi JOIN incantesimi i ON i.id = pi.incantesimo_id
    WHERE pi.personaggio_id = ? ORDER BY pi.ordine
  `).map((r): Spell => ({ ...voceIncantesimo(r), preparato: vero(r.preparato) }));
  c.inventario = tutte("SELECT * FROM personaggio_oggetti WHERE personaggio_id = ? ORDER BY ordine").map((r): InventoryItem => ({
    id: Number(r.id_locale), nome: testo(r.nome), qta: Number(r.qta), peso: Number(r.peso),
  }));
  c.privilegi = tutte(`
    SELECT pr.* FROM personaggio_privilegi pp JOIN privilegi pr ON pr.id = pp.privilegio_id
    WHERE pp.personaggio_id = ? ORDER BY pp.ordine
  `).map(privilegioDaRiga);
  c.lore = {
    tratti: testo(p.tratti), ideali: testo(p.ideali), legami: testo(p.legami), difetti: testo(p.difetti),
    backgroundBio: testo(p.background_bio),
  };
  return c;
}

export function creaPersonaggio(db: DatabaseSync, utenteId: number, c: CharacterData, revisione = 1): number {
  return transazione(db, () => {
    const esito = db.prepare("INSERT INTO personaggi (utente_id, revisione, aggiornato) VALUES (?, ?, ?)")
      .run(utenteId, revisione, new Date().toISOString());
    const id = Number(esito.lastInsertRowid);
    scomponi(db, id, c, utenteId);
    return id;
  });
}

export const elencoPersonaggi = (db: DatabaseSync, utenteId: number): RiassuntoPersonaggio[] =>
  db.prepare("SELECT id, nome, classe, sottoclasse, livello, razza FROM personaggi WHERE utente_id = ? ORDER BY id")
    .all(utenteId)
    .map(r => ({
      id: Number(r.id), nome: testo(r.nome), classe: testo(r.classe), sottoclasse: testo(r.sottoclasse),
      livello: Number(r.livello), razza: testo(r.razza),
    }));

// true se il personaggio esiste ed è di quell'utente.
export const diUtente = (db: DatabaseSync, id: number, utenteId: number) =>
  db.prepare("SELECT 1 FROM personaggi WHERE id = ? AND utente_id = ?").get(id, utenteId) !== undefined;
