import type { RiassuntoPersonaggio } from "@dnd/regole/api.ts";
import { CARATTERISTICHE } from "@dnd/regole/regole.ts";
import { personaggioVuoto } from "@dnd/regole/scheda.ts";
import type {
  ArmaPersonaggio, CategoriaNota, Caratteristica, CharacterData, CompetenzeAltre, Contatore, EffettoAttivo, InventoryItem,
  NotaSessione, Spell, XPRecord,
} from "@dnd/regole/tipi.ts";
import { armaDaRiga, armaturaDaRiga, colonneVoce, idVoci, privilegioDaRiga, voceIncantesimo } from "./catalogo.ts";
import { inserisciRighe, riga, righe, transazione, type Esecutore, type Riga } from "./db.ts";

// Il client lavora con la scheda intera (CharacterData); nell'archivio è divisa in tabelle.
// `scomponi` la scrive, `componi` la ricostruisce unendo i cataloghi.

const testo = (v: unknown) => (typeof v === "string" ? v : v === null || v === undefined ? "" : String(v));
const intero = (v: unknown, def = 0) => (typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : def);
const numero = (v: unknown, def = 0) => (typeof v === "number" && Number.isFinite(v) ? v : def);
const flag = (v: unknown) => v === true;
const contatore = (rimasti: unknown, massimo: unknown): Contatore | null =>
  massimo === null || massimo === undefined ? null : { rimasti: Number(rimasti ?? massimo), massimo: Number(massimo) };

// Tabelle figlie riscritte a ogni salvataggio.
const TABELLE_FIGLIE = [
  "personaggio_caratteristiche", "personaggio_abilita", "personaggio_slot", "personaggio_presagio",
  "personaggio_xp", "personaggio_oggetti", "personaggio_incantesimi", "personaggio_armi", "personaggio_privilegi",
  "personaggio_competenze", "personaggio_risorse", "personaggio_condizioni", "personaggio_effetti", "personaggio_note",
  "personaggio_note_campi",
];

// Competenze diverse da abilità e TS: tipo nella tabella `personaggio_competenze` → campo di CompetenzeAltre.
const TIPI_COMPETENZA: [string, keyof CompetenzeAltre][] = [
  ["lingua", "lingue"], ["strumento", "strumenti"], ["arma", "armi"], ["armatura", "armature"],
];

const nonVuoto = <T extends { nome?: unknown }>(x: T) => testo(x.nome).trim() !== "";

// `c` deve essere già normalizzata con daJSON(); qui si convertono comunque i tipi dei singoli campi,
// perché la scheda arriva dal client.
export async function scomponi(db: Esecutore, id: number, c: CharacterData, utenteId: number) {
  if (!Number.isInteger(id)) throw new Error(`Id del personaggio non valido: ${id}`);
  await transazione(db, async t => {
    // Una sola andata e ritorno per svuotare le tabelle figlie (id è un intero verificato).
    await t.query(TABELLE_FIGLIE.map(tabella => `DELETE FROM ${tabella} WHERE personaggio_id = ${id};`).join("\n"));

    // Incantesimi, armi, armatura e privilegi: le voci si cercano (o si creano) nel catalogo per nome.
    const incantesimi = c.incantesimi.map((s, ordine) => ({ s, ordine })).filter(({ s }) => nonVuoto(s));
    const idIncantesimi = await idVoci(t, "incantesimi", incantesimi.map(({ s }) => colonneVoce.incantesimo({
      nome: testo(s.nome).trim(), livello: intero(s.livello), scuola: testo(s.scuola), tempo: testo(s.tempo), scheda: s.scheda,
    })), utenteId);
    const armi = c.armi.map((a, ordine) => ({ a, ordine })).filter(({ a }) => nonVuoto(a));
    const idArmi = await idVoci(t, "armi", armi.map(({ a }) => colonneVoce.arma({
      nome: testo(a.nome).trim(), dado: testo(a.dado), tipoDanno: testo(a.tipoDanno), proprieta: testo(a.proprieta), accurata: a.accurata === true,
      ...(a.dadoVersatile ? { dadoVersatile: testo(a.dadoVersatile) } : {}),
      ...(a.categoria === "semplice" || a.categoria === "guerra" ? { categoria: a.categoria } : {}),
      ...(a.distanza ? { distanza: true } : {}),
    })), utenteId);
    const privilegi = c.privilegi.map((p, ordine) => ({ p, ordine })).filter(({ p }) => nonVuoto(p));
    const idPrivilegi = await idVoci(t, "privilegi", privilegi.map(({ p }) => colonneVoce.privilegio({
      nome: testo(p.nome).trim(), fonte: testo(p.fonte), descrizione: testo(p.descrizione),
    })), utenteId);
    const [armaturaId = null] = c.armatura && testo(c.armatura.nome).trim()
      ? await idVoci(t, "armature", [colonneVoce.armatura({ ...c.armatura, nome: testo(c.armatura.nome).trim() })], utenteId)
      : [];
    const concentrazione = c.concentrazione
      ? await riga(t, "SELECT id FROM incantesimi WHERE nome = $1", [c.concentrazione])
      : undefined;

    const { info, combattimento: pf, monete, lore } = c;
    const colonne: Record<string, unknown> = {
      nome: testo(info.nome), classe: testo(info.classe), sottoclasse: testo(info.sottoclasse),
      livello: intero(info.livello, 1), razza: testo(info.razza), background: testo(info.background),
      allineamento: testo(info.allineamento), giocatore: testo(info.giocatore), eta: intero(info.eta),
      altezza: testo(info.altezza), peso: testo(info.peso), occhi: testo(info.occhi), capelli: testo(info.capelli),
      carnagione: testo(info.carnagione), velocita: testo(info.velocita), taglia: testo(info.taglia) || "Media",
      ispirazione: flag(info.ispirazione), avatar: testo(info.avatar),
      indebolimento: Math.max(0, Math.min(6, intero(c.indebolimento))), armatura_id: armaturaId, scudo: flag(c.scudo),
      pf_attuali: intero(pf.pfAttuali), pf_massimi: intero(pf.pfMassimi), pf_temporanei: intero(pf.pfTemporanei),
      dadi_vita_rimanenti: intero(pf.dadiVitaRimanenti), ts_morte_successi: intero(pf.tsMorte?.successi),
      ts_morte_fallimenti: intero(pf.tsMorte?.fallimenti), stabile: flag(pf.stabile),
      concentrazione_id: concentrazione ? Number(concentrazione.id) : null,
      recupero_arcano_usato: flag(c.recuperoArcanoUsato),
      mr: intero(monete.mr), ma: intero(monete.ma), me: intero(monete.me), mo: intero(monete.mo), mp: intero(monete.mp),
      xp_totale: intero(c.xp.totale),
      tratti: testo(lore.tratti), ideali: testo(lore.ideali), legami: testo(lore.legami),
      difetti: testo(lore.difetti), background_bio: testo(lore.backgroundBio),
    };
    const nomi = Object.keys(colonne);
    await t.query(
      `UPDATE personaggi SET ${nomi.map((n, i) => `${n} = $${i + 1}`).join(", ")} WHERE id = $${nomi.length + 1}`,
      [...nomi.map(n => colonne[n]), id],
    );

    const inserisci = async (tabella: string, colonneTabella: string[], valori: unknown[][]) => {
      if (valori.length > 0) await inserisciRighe(t, tabella, colonneTabella, valori, "ON CONFLICT DO NOTHING");
    };
    await inserisci("personaggio_incantesimi", ["personaggio_id", "incantesimo_id", "preparato", "ordine"],
      incantesimi.map(({ s, ordine }, i) => [id, idIncantesimi[i], flag(s.preparato), ordine]));
    await inserisci("personaggio_armi", [
      "personaggio_id", "ordine", "id_locale", "arma_id", "bonus", "munizioni_rimaste", "munizioni_massime",
      "durabilita_rimasta", "durabilita_massima", "rotta",
    ], armi.map(({ a, ordine }, i) => [
      id, ordine, intero(a.id, ordine + 1), idArmi[i], intero(a.bonus),
      a.munizioni ? intero(a.munizioni.rimasti) : null, a.munizioni ? intero(a.munizioni.massimo) : null,
      // Un'arma danneggiata senza durabilità propria: solo i colpi rimasti, con il massimo a NULL.
      a.durabilita ? intero(a.durabilita.rimasti) : a.danneggiata !== null && a.danneggiata !== undefined ? intero(a.danneggiata) : null,
      a.durabilita ? intero(a.durabilita.massimo) : null,
      flag(a.rotta),
    ]));
    await inserisci("personaggio_privilegi", ["personaggio_id", "privilegio_id", "ordine"],
      privilegi.map(({ ordine }, i) => [id, idPrivilegi[i], ordine]));
    await inserisci("personaggio_competenze", ["personaggio_id", "tipo", "nome", "ordine"],
      TIPI_COMPETENZA.flatMap(([tipo, campo]) => c.competenzeAltre[campo].flatMap((nome, ordine) =>
        testo(nome).trim() ? [[id, tipo, testo(nome).trim(), ordine]] : [])));
    await inserisci("personaggio_caratteristiche", ["personaggio_id", "car", "valore", "comp_ts"],
      CARATTERISTICHE.map(k => [id, k, intero(c.caratteristiche[k].valore, 10), flag(c.caratteristiche[k].compTS)]));
    await inserisci("personaggio_abilita", ["personaggio_id", "abilita", "ordine"],
      c.competenzeAbilita.map((a, ordine) => [id, testo(a), ordine]));
    await inserisci("personaggio_slot", ["personaggio_id", "livello", "spesi"],
      c.slotSpesi.slice(0, 9).map((spesi, i) => [id, i + 1, intero(spesi)]));
    const { presagio: valori = [], usati = [] } = c.divinazione;
    await inserisci("personaggio_presagio", ["personaggio_id", "indice", "valore", "usato"],
      valori.map((v, i) => [id, i, intero(v), flag(usati[i])]));
    await inserisci("personaggio_xp", ["personaggio_id", "ordine", "id_locale", "data", "valore", "motivo"],
      c.xp.storico.map((r, i) => [id, i, intero(r.id, i + 1), testo(r.data), intero(r.valore), testo(r.motivo)]));
    await inserisci("personaggio_risorse", ["personaggio_id", "risorsa", "usati"],
      Object.entries(c.risorseUsate).filter(([, usati]) => intero(usati) > 0).map(([risorsa, usati]) => [id, risorsa, intero(usati)]));
    await inserisci("personaggio_condizioni", ["personaggio_id", "condizione", "ordine"],
      c.condizioni.map((condizione, i) => [id, testo(condizione), i]));
    await inserisci("personaggio_effetti", ["personaggio_id", "effetto", "valore", "ordine"],
      c.effetti.map((e, i) => [id, testo(e.id), typeof e.valore === "number" ? intero(e.valore) : null, i]));
    await inserisci("personaggio_note", ["personaggio_id", "ordine", "id_locale", "data", "categoria", "titolo", "testo", "fatto"],
      c.note.map((n, i) => [id, i, intero(n.id, i + 1), testo(n.data), testo(n.categoria), testo(n.titolo), testo(n.testo), flag(n.fatto)]));
    await inserisci("personaggio_note_campi", ["personaggio_id", "nota_ordine", "campo", "valore"],
      c.note.flatMap((n, i) => Object.entries(n.campi ?? {}).flatMap(([campo, valore]) =>
        testo(valore).trim() ? [[id, i, campo, testo(valore)]] : [])));
    await inserisci("personaggio_oggetti", ["personaggio_id", "ordine", "id_locale", "nome", "qta", "peso"],
      c.inventario.map((o, i) => [id, i, intero(o.id, i + 1), testo(o.nome), intero(o.qta, 1), numero(o.peso)]));
  });
}

// Lista di una tabella figlia come array JSON ordinato (vuoto se non ci sono righe).
const lista = (sql: string, ordine: string) =>
  `(SELECT coalesce(json_agg(x ORDER BY ${ordine}), '[]'::json) FROM (${sql}) x)`;

// Tutta la scheda in una sola query: ogni tabella figlia arriva come array JSON.
const SQL_SCHEDA = `
  SELECT p.*, i.nome AS concentrazione_nome,
    (SELECT row_to_json(a) FROM armature a WHERE a.id = p.armatura_id) AS armatura,
    ${lista("SELECT * FROM personaggio_caratteristiche WHERE personaggio_id = p.id", "x.car")} AS l_caratteristiche,
    ${lista("SELECT * FROM personaggio_abilita WHERE personaggio_id = p.id", "x.ordine")} AS l_abilita,
    ${lista("SELECT * FROM personaggio_slot WHERE personaggio_id = p.id", "x.livello")} AS l_slot,
    ${lista("SELECT * FROM personaggio_presagio WHERE personaggio_id = p.id", "x.indice")} AS l_presagio,
    ${lista("SELECT * FROM personaggio_xp WHERE personaggio_id = p.id", "x.ordine")} AS l_xp,
    ${lista("SELECT * FROM personaggio_oggetti WHERE personaggio_id = p.id", "x.ordine")} AS l_oggetti,
    ${lista("SELECT * FROM personaggio_competenze WHERE personaggio_id = p.id", "x.tipo, x.ordine")} AS l_competenze,
    ${lista("SELECT * FROM personaggio_risorse WHERE personaggio_id = p.id", "x.risorsa")} AS l_risorse,
    ${lista("SELECT * FROM personaggio_condizioni WHERE personaggio_id = p.id", "x.ordine")} AS l_condizioni,
    ${lista("SELECT * FROM personaggio_effetti WHERE personaggio_id = p.id", "x.ordine")} AS l_effetti,
    ${lista("SELECT * FROM personaggio_note WHERE personaggio_id = p.id", "x.ordine")} AS l_note,
    ${lista("SELECT * FROM personaggio_note_campi WHERE personaggio_id = p.id", "x.nota_ordine, x.campo")} AS l_note_campi,
    ${lista(`SELECT ic.*, pi.preparato, pi.ordine FROM personaggio_incantesimi pi
      JOIN incantesimi ic ON ic.id = pi.incantesimo_id WHERE pi.personaggio_id = p.id`, "x.ordine")} AS l_incantesimi,
    ${lista(`SELECT a.*, pa.ordine, pa.id_locale, pa.bonus, pa.munizioni_rimaste, pa.munizioni_massime, pa.durabilita_rimasta,
      pa.durabilita_massima, pa.rotta AS arma_rotta
      FROM personaggio_armi pa JOIN armi a ON a.id = pa.arma_id WHERE pa.personaggio_id = p.id`, "x.ordine")} AS l_armi,
    ${lista(`SELECT pr.*, pp.ordine FROM personaggio_privilegi pp
      JOIN privilegi pr ON pr.id = pp.privilegio_id WHERE pp.personaggio_id = p.id`, "x.ordine")} AS l_privilegi
  FROM personaggi p LEFT JOIN incantesimi i ON i.id = p.concentrazione_id
`;

function schedaDaRiga(p: Riga): CharacterData {
  const l = (nome: string) => p[`l_${nome}`] as Riga[];
  const c = personaggioVuoto();

  c.info = {
    nome: testo(p.nome), classe: testo(p.classe), sottoclasse: testo(p.sottoclasse), livello: Number(p.livello),
    razza: testo(p.razza), background: testo(p.background), allineamento: testo(p.allineamento),
    giocatore: testo(p.giocatore), eta: Number(p.eta), altezza: testo(p.altezza), peso: testo(p.peso),
    occhi: testo(p.occhi), capelli: testo(p.capelli), carnagione: testo(p.carnagione), velocita: testo(p.velocita),
    taglia: testo(p.taglia), ispirazione: flag(p.ispirazione), avatar: testo(p.avatar),
  };
  c.indebolimento = Number(p.indebolimento);
  c.risorseUsate = Object.fromEntries(l("risorse").map(r => [testo(r.risorsa), Number(r.usati)]));
  c.condizioni = l("condizioni").map(r => testo(r.condizione));
  c.effetti = l("effetti").map((r): EffettoAttivo =>
    r.valore === null ? { id: testo(r.effetto) } : { id: testo(r.effetto), valore: Number(r.valore) });
  const campiNote = new Map<number, Record<string, string>>();
  for (const r of l("note_campi")) {
    const ordine = Number(r.nota_ordine);
    campiNote.set(ordine, { ...campiNote.get(ordine), [testo(r.campo)]: testo(r.valore) });
  }
  c.note = l("note").map((r): NotaSessione => ({
    id: Number(r.id_locale), data: testo(r.data), categoria: testo(r.categoria) as CategoriaNota, titolo: testo(r.titolo),
    testo: testo(r.testo), fatto: flag(r.fatto), campi: campiNote.get(Number(r.ordine)) ?? {},
  }));
  c.armatura = p.armatura ? armaturaDaRiga(p.armatura as Riga) : null;
  c.scudo = flag(p.scudo);
  const competenze = l("competenze");
  for (const [tipo, campo] of TIPI_COMPETENZA) {
    c.competenzeAltre[campo] = competenze.filter(r => r.tipo === tipo).map(r => testo(r.nome));
  }
  for (const r of l("caratteristiche")) {
    c.caratteristiche[testo(r.car) as Caratteristica] = { valore: Number(r.valore), compTS: flag(r.comp_ts) };
  }
  c.competenzeAbilita = l("abilita").map(r => testo(r.abilita));
  c.combattimento = {
    pfAttuali: Number(p.pf_attuali), pfMassimi: Number(p.pf_massimi), pfTemporanei: Number(p.pf_temporanei),
    dadiVitaRimanenti: Number(p.dadi_vita_rimanenti),
    tsMorte: { successi: Number(p.ts_morte_successi), fallimenti: Number(p.ts_morte_fallimenti) },
    stabile: flag(p.stabile),
  };
  c.concentrazione = p.concentrazione_nome === null ? null : testo(p.concentrazione_nome);
  const presagio = l("presagio");
  c.divinazione = { presagio: presagio.map(r => Number(r.valore)), usati: presagio.map(r => flag(r.usato)) };
  c.recuperoArcanoUsato = flag(p.recupero_arcano_usato);
  c.monete = { mr: Number(p.mr), ma: Number(p.ma), me: Number(p.me), mo: Number(p.mo), mp: Number(p.mp) };
  c.xp = {
    totale: Number(p.xp_totale),
    storico: l("xp").map((r): XPRecord => ({
      id: Number(r.id_locale), data: testo(r.data), valore: Number(r.valore), motivo: testo(r.motivo),
    })),
  };
  c.armi = l("armi").map((r): ArmaPersonaggio => ({
    ...armaDaRiga(r),
    id: Number(r.id_locale), bonus: Number(r.bonus),
    munizioni: contatore(r.munizioni_rimaste, r.munizioni_massime),
    durabilita: contatore(r.durabilita_rimasta, r.durabilita_massima),
    danneggiata: r.durabilita_massima === null && r.durabilita_rimasta !== null ? Number(r.durabilita_rimasta) : null,
    rotta: flag(r.arma_rotta),
  }));
  for (const r of l("slot")) {
    const i = Number(r.livello) - 1;
    if (i >= 0 && i < 9) c.slotSpesi[i] = Number(r.spesi);
  }
  c.incantesimi = l("incantesimi").map((r): Spell => ({ ...voceIncantesimo(r), preparato: flag(r.preparato) }));
  c.inventario = l("oggetti").map((r): InventoryItem => ({
    id: Number(r.id_locale), nome: testo(r.nome), qta: Number(r.qta), peso: Number(r.peso),
  }));
  c.privilegi = l("privilegi").map(privilegioDaRiga);
  c.lore = {
    tratti: testo(p.tratti), ideali: testo(p.ideali), legami: testo(p.legami), difetti: testo(p.difetti),
    backgroundBio: testo(p.background_bio),
  };
  return c;
}

export async function componi(db: Esecutore, id: number): Promise<CharacterData | null> {
  const p = await riga(db, `${SQL_SCHEDA} WHERE p.id = $1`, [id]);
  return p ? schedaDaRiga(p) : null;
}

// Scheda e revisione, solo se il personaggio è dell'utente.
export async function componiDiUtente(db: Esecutore, id: number, utenteId: number): Promise<{ dati: CharacterData; revisione: number } | null> {
  const p = await riga(db, `${SQL_SCHEDA} WHERE p.id = $1 AND p.utente_id = $2`, [id, utenteId]);
  return p ? { dati: schedaDaRiga(p), revisione: Number(p.revisione) } : null;
}

// `id` e `aggiornato` servono solo all'import, che conserva quelli dell'archivio di provenienza.
export async function creaPersonaggio(
  db: Esecutore, utenteId: number, c: CharacterData, revisione = 1, opzioni: { id?: number; aggiornato?: Date } = {},
): Promise<number> {
  return transazione(db, async t => {
    const valori = [utenteId, revisione, opzioni.aggiornato ?? new Date()];
    const r = opzioni.id === undefined
      ? await riga(t, "INSERT INTO personaggi (utente_id, revisione, aggiornato) VALUES ($1, $2, $3) RETURNING id", valori)
      : await riga(t, "INSERT INTO personaggi (utente_id, revisione, aggiornato, id) VALUES ($1, $2, $3, $4) RETURNING id", [...valori, opzioni.id]);
    const id = Number(r!.id);
    await scomponi(t, id, c, utenteId);
    return id;
  });
}

export const elencoPersonaggi = async (db: Esecutore, utenteId: number): Promise<RiassuntoPersonaggio[]> =>
  (await righe(db, "SELECT id, nome, classe, sottoclasse, livello, razza, avatar FROM personaggi WHERE utente_id = $1 ORDER BY id", [utenteId]))
    .map(r => ({
      id: Number(r.id), nome: testo(r.nome), classe: testo(r.classe), sottoclasse: testo(r.sottoclasse),
      livello: Number(r.livello), razza: testo(r.razza), avatar: testo(r.avatar),
    }));
