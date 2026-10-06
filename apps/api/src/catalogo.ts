import type { VoceIncantesimo } from "@dnd/regole/api.ts";
import { SCELTE } from "@dnd/regole/dati/scelte.ts";
import { CARATTERISTICHE } from "@dnd/regole/regole.ts";
import { ARMATURE } from "@dnd/regole/semi/armature.ts";
import { ARMI } from "@dnd/regole/semi/armi.ts";
import { BACKGROUND } from "@dnd/regole/semi/background.ts";
import { PRIVILEGI_CLASSE } from "@dnd/regole/semi/classi.ts";
import { CLASSI_INCANTESIMI, SCHEDE_INCANTESIMI } from "@dnd/regole/semi/incantesimi.ts";
import { PRIVILEGI } from "@dnd/regole/semi/privilegi.ts";
import { RAZZE } from "@dnd/regole/semi/razze.ts";
import type {
  Arma, Armatura, BackgroundCatalogo, Caratteristica, CatalogoCreazione, DettagliIncantesimo, IncantesimoCatalogo, Privilegio,
  PrivilegioClasse, RazzaCatalogo,
} from "@dnd/regole/tipi.ts";
import { inserisciRighe, righe, transazione, type Esecutore, type Riga } from "./db.ts";

// Cataloghi condivisi: incantesimi, armi, armature, privilegi, razze, background. Ogni voce ha `creato_da`:
// NULL per quelle ufficiali (dai seed in @dnd/regole/semi), altrimenti l'id dell'utente che l'ha aggiunta.
// Le voci si riconoscono per nome (i privilegi per nome + fonte), senza distinguere le maiuscole.

type Valori = Record<string, unknown>;

const testo = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const facoltativo = (v: unknown) => (v === null || v === undefined ? undefined : v);
// Chiave di confronto dei nomi, come citext.
const chiave = (...parti: unknown[]) => parti.map(p => testo(p).toLowerCase()).join("|");

// --- Conversione tra oggetti e colonne ---

function colonneIncantesimo(nome: string, livello: number, scuola: string, tempo: string, s?: DettagliIncantesimo): Valori {
  return {
    nome, livello, scuola, tempo,
    gittata: s?.gittata ?? null,
    componenti: s?.componenti ?? null,
    durata: s?.durata ?? null,
    concentrazione: s?.concentrazione === true,
    rituale: s?.rituale === true,
    descrizione: s?.descrizione ?? null,
    livello_superiore: s?.livelloSuperiore ?? null,
    attacco_numero: s?.attacco?.numero ?? null,
    attacco_per_livello: s?.attacco?.perLivello ?? null,
    ts_caratteristica: s?.tiroSalvezza?.car ?? null,
    ts_effetto: s?.tiroSalvezza?.effetto ?? null,
    danni_dado: s?.danni?.dado ?? null,
    danni_tipo: s?.danni?.tipo ?? null,
    danni_mod: s?.danni?.mod ?? null,
    danni_per_livello: s?.danni?.perLivello ?? null,
    danni_mod_per_livello: s?.danni?.modPerLivello ?? null,
    danni_trucchetto: s?.danni?.trucchetto === true,
    danni_per_attacco: s?.danni?.perAttacco === true,
  };
}

// I campi facoltativi compaiono solo se valorizzati, come nei seed.
export function voceIncantesimo(r: Riga): VoceIncantesimo {
  const voce: VoceIncantesimo = {
    id: Number(r.id), nome: testo(r.nome), livello: Number(r.livello), scuola: testo(r.scuola), tempo: testo(r.tempo),
  };
  if (r.descrizione === null || r.descrizione === undefined) return voce; // voce senza dettagli: si può solo spendere lo slot
  const s: DettagliIncantesimo = {
    gittata: testo(r.gittata), componenti: testo(r.componenti), durata: testo(r.durata),
    concentrazione: r.concentrazione === true, rituale: r.rituale === true, descrizione: testo(r.descrizione),
  };
  if (r.livello_superiore !== null) s.livelloSuperiore = testo(r.livello_superiore);
  if (r.attacco_numero !== null) {
    s.attacco = { numero: Number(r.attacco_numero) };
    if (r.attacco_per_livello !== null) s.attacco.perLivello = Number(r.attacco_per_livello);
  }
  if (r.ts_caratteristica !== null) {
    s.tiroSalvezza = { car: testo(r.ts_caratteristica) as Caratteristica, effetto: testo(r.ts_effetto) };
  }
  if (r.danni_dado !== null) {
    s.danni = { dado: testo(r.danni_dado), tipo: testo(r.danni_tipo) };
    if (r.danni_mod !== null) s.danni.mod = Number(r.danni_mod);
    if (r.danni_per_livello !== null) s.danni.perLivello = testo(r.danni_per_livello);
    if (r.danni_mod_per_livello !== null) s.danni.modPerLivello = Number(r.danni_mod_per_livello);
    if (r.danni_trucchetto === true) s.danni.trucchetto = true;
    if (r.danni_per_attacco === true) s.danni.perAttacco = true;
  }
  voce.scheda = s;
  return voce;
}

const colonneArma = (a: Arma): Valori => ({
  nome: a.nome, dado: a.dado, dado_versatile: a.dadoVersatile ?? null,
  tipo_danno: a.tipoDanno, proprieta: a.proprieta, accurata: a.accurata === true,
  categoria: a.categoria ?? null, distanza: a.distanza === true,
});

export function armaDaRiga(r: Riga): Arma {
  const arma: Arma = {
    nome: testo(r.nome), dado: testo(r.dado), tipoDanno: testo(r.tipo_danno), proprieta: testo(r.proprieta),
    accurata: r.accurata === true,
  };
  const versatile = facoltativo(r.dado_versatile);
  if (versatile !== undefined) arma.dadoVersatile = String(versatile);
  if (r.categoria === "semplice" || r.categoria === "guerra") arma.categoria = r.categoria;
  if (r.distanza === true) arma.distanza = true;
  return arma;
}

const colonneArmatura = (a: Armatura): Valori => ({
  nome: a.nome, categoria: a.categoria, ca: a.ca, max_des: a.maxDes, forza_min: a.forzaMin,
  svantaggio_furtivita: a.svantaggioFurtivita === true, peso: a.peso,
});

export const armaturaDaRiga = (r: Riga): Armatura => ({
  nome: testo(r.nome),
  categoria: r.categoria === "media" || r.categoria === "pesante" ? r.categoria : "leggera",
  ca: Number(r.ca),
  maxDes: r.max_des === null ? null : Number(r.max_des),
  forzaMin: Number(r.forza_min),
  svantaggioFurtivita: r.svantaggio_furtivita === true,
  peso: Number(r.peso),
});

const colonnePrivilegio = (p: Privilegio): Valori => ({ nome: p.nome, fonte: p.fonte, descrizione: p.descrizione });

export const privilegioDaRiga = (r: Riga): Privilegio => ({
  nome: testo(r.nome), fonte: testo(r.fonte), descrizione: testo(r.descrizione),
});

// --- Scrittura ---

// Upsert delle voci ufficiali in una query (a blocchi). Le voci create dagli utenti non vengono
// toccate, neanche se hanno lo stesso nome. A parità di chiave vale l'ultima voce, nella posizione della prima.
async function aggiornaVoci(db: Esecutore, tabella: string, voci: Valori[], conflitto: string[]) {
  if (voci.length === 0) return;
  const uniche = new Map<string, Valori>();
  for (const v of voci) uniche.set(chiave(...conflitto.map(c => v[c])), v);
  const colonne = Object.keys(voci[0]);
  await inserisciRighe(db, tabella, colonne, [...uniche.values()].map(v => colonne.map(c => v[c])), `
    ON CONFLICT (${conflitto.join(", ")}) DO UPDATE SET ${colonne.map(c => `${c} = excluded.${c}`).join(", ")}
    WHERE ${tabella}.creato_da IS NULL
  `);
}

// Id delle voci per chiave (nome, o nome + fonte). Con `soloUfficiali` solo quelle dei seed.
async function mappaId(db: Esecutore, tabella: string, colonneChiave: string[], soloUfficiali = false) {
  const mappa = new Map<string, number>();
  const dove = soloUfficiali ? "WHERE creato_da IS NULL" : "";
  for (const r of await righe(db, `SELECT id, ${colonneChiave.join(", ")} FROM ${tabella} ${dove}`)) {
    mappa.set(chiave(...colonneChiave.map(c => r[c])), Number(r.id));
  }
  return mappa;
}

// Porta nell'archivio le voci ufficiali dei seed (la "semina"). Le tabelle di collegamento delle voci
// ufficiali (competenze e privilegi di razze e background, privilegi di classe, classi degli
// incantesimi) vengono riscritte dai seed. Si esegue al deploy, dopo le migrazioni.
export async function aggiornaCataloghi(db: Esecutore) {
  await transazione(db, async t => {
    await aggiornaVoci(t, "incantesimi",
      Object.entries(SCHEDE_INCANTESIMI).map(([nome, s]) => colonneIncantesimo(nome, s.livello, s.scuola, s.tempo, s)), ["nome"]);
    await aggiornaVoci(t, "armi", ARMI.map(colonneArma), ["nome"]);
    await aggiornaVoci(t, "armature", ARMATURE.map(colonneArmatura), ["nome"]);
    await aggiornaVoci(t, "privilegi", PRIVILEGI.map(colonnePrivilegio), ["nome", "fonte"]);
    const privilegi = await mappaId(t, "privilegi", ["nome", "fonte"]);
    const idPrivilegio = (p: Privilegio) => privilegi.get(chiave(p.nome, p.fonte)) ?? null;

    await t.query("DELETE FROM incantesimo_classi WHERE incantesimo_id IN (SELECT id FROM incantesimi WHERE creato_da IS NULL)");
    const incantesimi = await mappaId(t, "incantesimi", ["nome"]);
    await inserisciRighe(t, "incantesimo_classi", ["incantesimo_id", "classe"],
      Object.entries(CLASSI_INCANTESIMI).flatMap(([nome, classi]) => {
        const id = incantesimi.get(chiave(nome));
        return id === undefined ? [] : classi.map(classe => [id, classe]);
      }), "ON CONFLICT DO NOTHING");

    await aggiornaRazze(t, idPrivilegio);
    await aggiornaBackground(t, idPrivilegio);

    await t.query("DELETE FROM classe_privilegi");
    await inserisciRighe(t, "classe_privilegi", ["classe", "sottoclasse", "livello", "privilegio_id", "ordine"],
      PRIVILEGI_CLASSE.map((c, ordine) => [c.classe, c.sottoclasse ?? "", c.livello, idPrivilegio(c.privilegio), ordine]),
      "ON CONFLICT DO NOTHING");
  });
}

async function aggiornaRazze(db: Esecutore, idPrivilegio: (p: Privilegio) => number | null) {
  await aggiornaVoci(db, "razze", RAZZE.map(r => ({
    nome: r.nome, taglia: r.taglia ?? null, velocita: r.velocita ?? null,
    ...Object.fromEntries(CARATTERISTICHE.map(k => [`bonus_${k.toLowerCase()}`, r.bonus[k] ?? 0])),
    bonus_a_scelta: r.bonusAScelta ?? 0, abilita_a_scelta: r.abilitaAScelta ?? 0, lingue_a_scelta: r.lingueAScelta ?? 0,
    trucchetto: r.trucchetto ?? null,
  })), ["nome"]);
  const tutte = await mappaId(db, "razze", ["nome"]);
  const ufficiali = await mappaId(db, "razze", ["nome"], true);
  // Una voce dello stesso nome creata da un utente non è ufficiale: i suoi collegamenti non si toccano.
  const daAggiornare = RAZZE.flatMap(r => {
    const id = ufficiali.get(chiave(r.nome));
    return id === undefined ? [] : [{ r, id }];
  });
  const ids = daAggiornare.map(x => x.id);
  await db.query(`
    UPDATE razze SET razza_madre_id = v.madre FROM unnest($1::integer[], $2::integer[]) AS v(id, madre) WHERE razze.id = v.id
  `, [ids, daAggiornare.map(({ r }) => (r.madre ? tutte.get(chiave(r.madre)) ?? null : null))]);
  await db.query("DELETE FROM razza_competenze WHERE razza_id = ANY($1::integer[])", [ids]);
  await db.query("DELETE FROM razza_privilegi WHERE razza_id = ANY($1::integer[])", [ids]);
  await inserisciRighe(db, "razza_competenze", ["razza_id", "tipo", "nome", "ordine"], daAggiornare.flatMap(({ r, id }) =>
    ([["abilita", r.abilita], ["lingua", r.lingue], ["arma", r.armi], ["armatura", r.armature], ["strumento_a_scelta", r.strumentiAScelta]] as const)
      .flatMap(([tipo, nomi]) => (nomi ?? []).map((nome, ordine) => [id, tipo, nome, ordine]))), "ON CONFLICT DO NOTHING");
  await inserisciRighe(db, "razza_privilegi", ["razza_id", "privilegio_id", "ordine"], daAggiornare.flatMap(({ r, id }) =>
    r.privilegi.map((p, ordine) => [id, idPrivilegio(p), ordine])), "ON CONFLICT DO NOTHING");
}

async function aggiornaBackground(db: Esecutore, idPrivilegio: (p: Privilegio) => number | null) {
  await aggiornaVoci(db, "background", BACKGROUND.map(b => ({
    nome: b.nome, strumenti_a_scelta: b.strumentiAScelta ?? null, lingue_a_scelta: b.lingueAScelta, mo: b.mo,
    privilegio_id: idPrivilegio(b.privilegio),
  })), ["nome"]);
  const ufficiali = await mappaId(db, "background", ["nome"], true);
  const daAggiornare = BACKGROUND.flatMap(b => {
    const id = ufficiali.get(chiave(b.nome));
    return id === undefined ? [] : [{ b, id }];
  });
  const ids = daAggiornare.map(x => x.id);
  await db.query("DELETE FROM background_competenze WHERE background_id = ANY($1::integer[])", [ids]);
  await db.query("DELETE FROM background_oggetti WHERE background_id = ANY($1::integer[])", [ids]);
  await inserisciRighe(db, "background_competenze", ["background_id", "tipo", "nome", "ordine"], daAggiornare.flatMap(({ b, id }) => [
    ...b.abilita.map((nome, ordine) => [id, "abilita", nome, ordine]),
    ...b.strumenti.map((nome, ordine) => [id, "strumento", nome, ordine]),
  ]), "ON CONFLICT DO NOTHING");
  await inserisciRighe(db, "background_oggetti", ["background_id", "ordine", "nome", "qta", "peso"], daAggiornare.flatMap(({ b, id }) =>
    b.equipaggiamento.map((o, ordine) => [id, ordine, o.nome, o.qta, o.peso])));
}

// Id delle voci di catalogo nominate da una scheda, nello stesso ordine. Quelle che non esistono
// si creano come voci dell'utente; i campi di una voce esistente non cambiano: valgono quelli del catalogo.
// Tutto in poche query, qualunque sia il numero delle voci.
export async function idVoci(
  db: Esecutore, tabella: "incantesimi" | "armi" | "armature" | "privilegi", voci: Valori[], utenteId: number,
): Promise<number[]> {
  if (voci.length === 0) return [];
  const colonneChiave = tabella === "privilegi" ? ["nome", "fonte"] : ["nome"];
  const chiaveDi = (v: Valori) => chiave(...colonneChiave.map(c => v[c]));
  const cerca = async (daCercare: Valori[]) => {
    const parametri = colonneChiave.map(c => daCercare.map(v => testo(v[c])));
    const filtro = `(${colonneChiave.join(", ")}) IN (SELECT * FROM unnest(${colonneChiave.map((_, i) => `$${i + 1}::citext[]`).join(", ")}))`;
    const mappa = new Map<string, number>();
    for (const r of await righe(db, `SELECT id, ${colonneChiave.join(", ")} FROM ${tabella} WHERE ${filtro}`, parametri)) {
      mappa.set(chiave(...colonneChiave.map(c => r[c])), Number(r.id));
    }
    return mappa;
  };

  const trovate = await cerca(voci);
  const mancanti = new Map<string, Valori>();
  for (const v of voci) if (!trovate.has(chiaveDi(v)) && !mancanti.has(chiaveDi(v))) mancanti.set(chiaveDi(v), v);
  if (mancanti.size > 0) {
    const nuove: Valori[] = [...mancanti.values()].map(v => ({ ...v, creato_da: utenteId }));
    const colonne = Object.keys(nuove[0]);
    await inserisciRighe(db, tabella, colonne, nuove.map(v => colonne.map(c => v[c])), "ON CONFLICT DO NOTHING");
    // Rilette anche quelle create nel frattempo da un'altra richiesta (ON CONFLICT DO NOTHING non le restituisce).
    for (const [k, id] of await cerca([...mancanti.values()])) trovate.set(k, id);
  }
  return voci.map(v => {
    const id = trovate.get(chiaveDi(v));
    if (id === undefined) throw new Error(`Voce di catalogo non risolta: ${chiaveDi(v)}`);
    return id;
  });
}

export const colonneVoce = {
  incantesimo: (s: { nome: string; livello: number; scuola: string; tempo: string; scheda?: DettagliIncantesimo }) =>
    colonneIncantesimo(s.nome, s.livello, s.scuola, s.tempo, s.scheda),
  arma: colonneArma,
  armatura: colonneArmatura,
  privilegio: colonnePrivilegio,
};

// --- Lettura ---

export const elencoIncantesimi = async (db: Esecutore): Promise<VoceIncantesimo[]> =>
  (await righe(db, "SELECT * FROM incantesimi ORDER BY livello, nome")).map(voceIncantesimo);

// Raggruppa righe per una colonna numerica.
function perId(righeDa: Riga[], colonna: string): Map<number, Riga[]> {
  const gruppi = new Map<number, Riga[]>();
  for (const r of righeDa) {
    const id = Number(r[colonna]);
    gruppi.set(id, [...(gruppi.get(id) ?? []), r]);
  }
  return gruppi;
}

async function elencoRazze(db: Esecutore): Promise<RazzaCatalogo[]> {
  const competenze = perId(await righe(db, "SELECT razza_id, tipo, nome FROM razza_competenze ORDER BY razza_id, tipo, ordine"), "razza_id");
  const privilegi = perId(await righe(db, `
    SELECT rp.razza_id, p.* FROM razza_privilegi rp JOIN privilegi p ON p.id = rp.privilegio_id ORDER BY rp.razza_id, rp.ordine
  `), "razza_id");
  const razze = await righe(db, "SELECT r.*, m.nome AS madre FROM razze r LEFT JOIN razze m ON m.id = r.razza_madre_id ORDER BY r.id");
  return razze.map(r => {
    const id = Number(r.id);
    const delTipo = (tipo: string) => (competenze.get(id) ?? []).filter(c => c.tipo === tipo).map(c => testo(c.nome));
    const bonus: Partial<Record<Caratteristica, number>> = {};
    for (const k of CARATTERISTICHE) {
      const v = Number(r[`bonus_${k.toLowerCase()}`]);
      if (v) bonus[k] = v;
    }
    return {
      nome: testo(r.nome), madre: r.madre === null ? null : testo(r.madre),
      taglia: r.taglia === null ? null : testo(r.taglia), velocita: r.velocita === null ? null : testo(r.velocita),
      bonus, bonusAScelta: Number(r.bonus_a_scelta),
      abilita: delTipo("abilita"), abilitaAScelta: Number(r.abilita_a_scelta),
      lingue: delTipo("lingua"), lingueAScelta: Number(r.lingue_a_scelta),
      armi: delTipo("arma"), armature: delTipo("armatura"), strumentiAScelta: delTipo("strumento_a_scelta"),
      trucchetto: r.trucchetto === null ? null : testo(r.trucchetto),
      privilegi: (privilegi.get(id) ?? []).map(privilegioDaRiga),
    };
  });
}

async function elencoBackground(db: Esecutore): Promise<BackgroundCatalogo[]> {
  const competenze = perId(await righe(db, "SELECT background_id, tipo, nome FROM background_competenze ORDER BY background_id, tipo, ordine"), "background_id");
  const oggetti = perId(await righe(db, "SELECT background_id, nome, qta, peso FROM background_oggetti ORDER BY background_id, ordine"), "background_id");
  const background = await righe(db, `
    SELECT b.*, p.nome AS p_nome, p.fonte AS p_fonte, p.descrizione AS p_descrizione
    FROM background b JOIN privilegi p ON p.id = b.privilegio_id ORDER BY b.nome
  `);
  return background.map(b => {
    const id = Number(b.id);
    const delTipo = (tipo: string) => (competenze.get(id) ?? []).filter(c => c.tipo === tipo).map(c => testo(c.nome));
    const scelta = b.strumenti_a_scelta;
    return {
      nome: testo(b.nome), abilita: delTipo("abilita"), strumenti: delTipo("strumento"),
      strumentiAScelta: scelta === "artigiano" || scelta === "musicale" || scelta === "gioco" ? scelta : null,
      lingueAScelta: Number(b.lingue_a_scelta),
      equipaggiamento: (oggetti.get(id) ?? []).map(o => ({ nome: testo(o.nome), qta: Number(o.qta), peso: Number(o.peso) })),
      mo: Number(b.mo),
      privilegio: { nome: testo(b.p_nome), fonte: testo(b.p_fonte), descrizione: testo(b.p_descrizione) },
    };
  });
}

// Privilegi di classe; con `livello` solo quelli di quel livello, con `fino` tutti quelli fino a quel livello,
// con `sottoclasse` anche i suoi.
export async function privilegiDiClasse(
  db: Esecutore, filtro: { classe?: string; livello?: number; fino?: number; sottoclasse?: string } = {},
): Promise<PrivilegioClasse[]> {
  const condizioni: string[] = [];
  const valori: unknown[] = [];
  const aggiungi = (sql: (n: string) => string, valore: unknown) => {
    valori.push(valore);
    condizioni.push(sql(`$${valori.length}`));
  };
  if (filtro.classe !== undefined) aggiungi(n => `cp.classe = ${n}`, filtro.classe);
  if (filtro.livello !== undefined) aggiungi(n => `cp.livello = ${n}`, filtro.livello);
  if (filtro.fino !== undefined) aggiungi(n => `cp.livello <= ${n}`, filtro.fino);
  if (filtro.sottoclasse !== undefined) aggiungi(n => `(cp.sottoclasse = '' OR cp.sottoclasse = ${n})`, filtro.sottoclasse);
  const dove = condizioni.length ? `WHERE ${condizioni.join(" AND ")}` : "";
  return (await righe(db, `
    SELECT cp.classe, cp.sottoclasse, cp.livello, p.nome, p.fonte, p.descrizione
    FROM classe_privilegi cp JOIN privilegi p ON p.id = cp.privilegio_id ${dove}
    ORDER BY cp.livello, cp.sottoclasse <> '', cp.ordine
  `, valori)).map(r => ({
    classe: testo(r.classe), sottoclasse: r.sottoclasse === "" ? null : testo(r.sottoclasse), livello: Number(r.livello),
    privilegio: privilegioDaRiga(r),
  }));
}

// Opzioni ufficiali delle scelte di privilegio, nell'ordine del seed.
async function opzioniPrivilegio(db: Esecutore): Promise<Privilegio[]> {
  const fonti = [...new Set(SCELTE.map(s => s.fonte))];
  return (await righe(db, `
    SELECT * FROM privilegi WHERE creato_da IS NULL AND fonte = ANY($1::citext[]) ORDER BY fonte, id
  `, [fonti])).map(privilegioDaRiga);
}

// Tutto ciò che serve alla procedura di creazione, in una sola risposta.
export async function catalogoCreazione(db: Esecutore): Promise<CatalogoCreazione> {
  const classi = new Map<number, string[]>();
  for (const r of await righe(db, "SELECT incantesimo_id, classe FROM incantesimo_classi")) {
    const id = Number(r.incantesimo_id);
    classi.set(id, [...(classi.get(id) ?? []), testo(r.classe)]);
  }
  return {
    razze: await elencoRazze(db),
    background: await elencoBackground(db),
    armi: (await righe(db, "SELECT * FROM armi ORDER BY categoria, nome")).map(armaDaRiga),
    armature: (await righe(db, "SELECT * FROM armature ORDER BY ca, nome")).map(armaturaDaRiga),
    privilegiClasse: await privilegiDiClasse(db, { livello: 1 }),
    opzioniPrivilegio: await opzioniPrivilegio(db),
    incantesimi: (await elencoIncantesimi(db)).map((v): IncantesimoCatalogo => ({ ...v, classi: classi.get(v.id) ?? [] })),
  };
}
