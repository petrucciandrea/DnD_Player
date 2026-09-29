import type { DatabaseSync, SQLInputValue, SQLOutputValue } from "node:sqlite";
import type {
  Arma, Armatura, BackgroundCatalogo, Caratteristica, CatalogoCreazione, DettagliIncantesimo, IncantesimoCatalogo, Privilegio,
  PrivilegioClasse, RazzaCatalogo,
} from "../src/tipi.ts";
import { CARATTERISTICHE } from "../src/regole.ts";
import { ARMATURE } from "./semi/armature.ts";
import { ARMI } from "./semi/armi.ts";
import { BACKGROUND } from "./semi/background.ts";
import { PRIVILEGI_CLASSE } from "./semi/classi.ts";
import { CLASSI_INCANTESIMI, SCHEDE_INCANTESIMI } from "./semi/incantesimi.ts";
import { PRIVILEGI } from "./semi/privilegi.ts";
import { RAZZE } from "./semi/razze.ts";

// Cataloghi condivisi: incantesimi, armi e privilegi. Ogni voce ha `creato_da`: NULL per quelle
// ufficiali (dai seed in server/semi), altrimenti l'id dell'utente che l'ha aggiunta.
// Le voci si riconoscono per nome (i privilegi per nome + fonte), senza distinguere le maiuscole.

type Riga = Record<string, SQLOutputValue>;
type Valori = Record<string, SQLInputValue>;

// Voce del catalogo degli incantesimi come la vede il client (GET /api/incantesimi).
export interface VoceIncantesimo {
  id: number;
  nome: string;
  livello: number;
  scuola: string;
  tempo: string;
  scheda?: DettagliIncantesimo;
}

const testo = (v: SQLOutputValue) => (v === null ? "" : String(v));
const facoltativo = (v: SQLOutputValue) => (v === null ? undefined : v);

// --- Conversione tra oggetti e colonne ---

function colonneIncantesimo(nome: string, livello: number, scuola: string, tempo: string, s?: DettagliIncantesimo): Valori {
  return {
    nome, livello, scuola, tempo,
    gittata: s?.gittata ?? null,
    componenti: s?.componenti ?? null,
    durata: s?.durata ?? null,
    concentrazione: s?.concentrazione ? 1 : 0,
    rituale: s?.rituale ? 1 : 0,
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
    danni_trucchetto: s?.danni?.trucchetto ? 1 : null,
    danni_per_attacco: s?.danni?.perAttacco ? 1 : null,
  };
}

// I campi facoltativi compaiono solo se valorizzati, come nei seed.
export function voceIncantesimo(r: Riga): VoceIncantesimo {
  const voce: VoceIncantesimo = {
    id: Number(r.id), nome: testo(r.nome), livello: Number(r.livello), scuola: testo(r.scuola), tempo: testo(r.tempo),
  };
  if (r.descrizione === null) return voce; // voce senza dettagli: si può solo spendere lo slot
  const s: DettagliIncantesimo = {
    gittata: testo(r.gittata), componenti: testo(r.componenti), durata: testo(r.durata),
    concentrazione: r.concentrazione === 1, rituale: r.rituale === 1, descrizione: testo(r.descrizione),
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
    if (r.danni_trucchetto === 1) s.danni.trucchetto = true;
    if (r.danni_per_attacco === 1) s.danni.perAttacco = true;
  }
  voce.scheda = s;
  return voce;
}

const colonneArma = (a: Arma): Valori => ({
  nome: a.nome, dado: a.dado, dado_versatile: a.dadoVersatile ?? null,
  tipo_danno: a.tipoDanno, proprieta: a.proprieta, accurata: a.accurata ? 1 : 0,
  categoria: a.categoria ?? null, distanza: a.distanza ? 1 : 0,
});

export function armaDaRiga(r: Riga): Arma {
  const arma: Arma = {
    nome: testo(r.nome), dado: testo(r.dado), tipoDanno: testo(r.tipo_danno), proprieta: testo(r.proprieta),
    accurata: r.accurata === 1,
  };
  const versatile = facoltativo(r.dado_versatile);
  if (versatile !== undefined) arma.dadoVersatile = String(versatile);
  if (r.categoria === "semplice" || r.categoria === "guerra") arma.categoria = r.categoria;
  if (r.distanza === 1) arma.distanza = true;
  return arma;
}

const colonneArmatura = (a: Armatura): Valori => ({
  nome: a.nome, categoria: a.categoria, ca: a.ca, max_des: a.maxDes, forza_min: a.forzaMin,
  svantaggio_furtivita: a.svantaggioFurtivita ? 1 : 0, peso: a.peso,
});

export const armaturaDaRiga = (r: Riga): Armatura => ({
  nome: testo(r.nome),
  categoria: r.categoria === "media" || r.categoria === "pesante" ? r.categoria : "leggera",
  ca: Number(r.ca),
  maxDes: r.max_des === null ? null : Number(r.max_des),
  forzaMin: Number(r.forza_min),
  svantaggioFurtivita: r.svantaggio_furtivita === 1,
  peso: Number(r.peso),
});

const colonnePrivilegio = (p: Privilegio): Valori => ({ nome: p.nome, fonte: p.fonte, descrizione: p.descrizione });

export const privilegioDaRiga = (r: Riga): Privilegio => ({
  nome: testo(r.nome), fonte: testo(r.fonte), descrizione: testo(r.descrizione),
});

// --- Scrittura ---

function inserisci(db: DatabaseSync, tabella: string, valori: Valori, conflitto?: string): number {
  const colonne = Object.keys(valori);
  const aggiorna = conflitto
    ? ` ON CONFLICT(${conflitto}) DO UPDATE SET ${colonne.map(c => `${c} = excluded.${c}`).join(", ")} WHERE ${tabella}.creato_da IS NULL`
    : "";
  const esito = db.prepare(
    `INSERT INTO ${tabella} (${colonne.join(", ")}) VALUES (${colonne.map(c => `:${c}`).join(", ")})${aggiorna}`,
  ).run(valori);
  return Number(esito.lastInsertRowid);
}

const idPerNome = (db: DatabaseSync, tabella: string, nome: string) =>
  Number(db.prepare(`SELECT id FROM ${tabella} WHERE nome = ?`).get(nome)?.id);

const idPrivilegioUfficiale = (db: DatabaseSync, p: Privilegio) =>
  Number(db.prepare("SELECT id FROM privilegi WHERE nome = ? AND fonte = ?").get(p.nome, p.fonte)?.id);

// Porta nell'archivio le voci ufficiali dei seed. Le voci create dagli utenti non vengono toccate,
// neanche se hanno lo stesso nome di una voce ufficiale. Le tabelle di collegamento delle voci
// ufficiali (competenze e privilegi di razze e background, privilegi di classe, classi degli
// incantesimi) vengono riscritte dai seed.
export function aggiornaCataloghi(db: DatabaseSync) {
  for (const [nome, s] of Object.entries(SCHEDE_INCANTESIMI)) {
    inserisci(db, "incantesimi", colonneIncantesimo(nome, s.livello, s.scuola, s.tempo, s), "nome");
  }
  for (const a of ARMI) inserisci(db, "armi", colonneArma(a), "nome");
  for (const a of ARMATURE) inserisci(db, "armature", colonneArmatura(a), "nome");
  for (const p of PRIVILEGI) inserisci(db, "privilegi", colonnePrivilegio(p), "nome, fonte");

  db.exec("DELETE FROM incantesimo_classi WHERE incantesimo_id IN (SELECT id FROM incantesimi WHERE creato_da IS NULL)");
  const classeIncantesimo = db.prepare("INSERT OR IGNORE INTO incantesimo_classi (incantesimo_id, classe) VALUES (?, ?)");
  for (const [nome, classi] of Object.entries(CLASSI_INCANTESIMI)) {
    for (const classe of classi) classeIncantesimo.run(idPerNome(db, "incantesimi", nome), classe);
  }

  aggiornaRazze(db);
  aggiornaBackground(db);

  db.exec("DELETE FROM classe_privilegi");
  const privilegioClasse = db.prepare(
    "INSERT OR IGNORE INTO classe_privilegi (classe, sottoclasse, livello, privilegio_id, ordine) VALUES (?, ?, ?, ?, ?)",
  );
  PRIVILEGI_CLASSE.forEach((c, ordine) =>
    privilegioClasse.run(c.classe, c.sottoclasse ?? "", c.livello, idPrivilegioUfficiale(db, c.privilegio), ordine));
}

function aggiornaRazze(db: DatabaseSync) {
  for (const r of RAZZE) {
    inserisci(db, "razze", {
      nome: r.nome, taglia: r.taglia ?? null, velocita: r.velocita ?? null,
      ...Object.fromEntries(CARATTERISTICHE.map(k => [`bonus_${k.toLowerCase()}`, r.bonus[k] ?? 0])),
      bonus_a_scelta: r.bonusAScelta ?? 0, abilita_a_scelta: r.abilitaAScelta ?? 0, lingue_a_scelta: r.lingueAScelta ?? 0,
      trucchetto: r.trucchetto ?? null,
    }, "nome");
  }
  const ufficiale = (nome: string) =>
    db.prepare("SELECT id FROM razze WHERE nome = ? AND creato_da IS NULL").get(nome);
  const competenza = db.prepare("INSERT OR IGNORE INTO razza_competenze (razza_id, tipo, nome) VALUES (?, ?, ?)");
  const privilegio = db.prepare("INSERT OR IGNORE INTO razza_privilegi (razza_id, privilegio_id, ordine) VALUES (?, ?, ?)");
  for (const r of RAZZE) {
    const riga = ufficiale(r.nome);
    if (!riga) continue; // voce dello stesso nome creata da un utente
    const id = Number(riga.id);
    const madre = r.madre ? idPerNome(db, "razze", r.madre) : null;
    db.prepare("UPDATE razze SET razza_madre_id = ? WHERE id = ?").run(madre, id);
    db.prepare("DELETE FROM razza_competenze WHERE razza_id = ?").run(id);
    db.prepare("DELETE FROM razza_privilegi WHERE razza_id = ?").run(id);
    for (const [tipo, nomi] of [
      ["abilita", r.abilita], ["lingua", r.lingue], ["arma", r.armi], ["armatura", r.armature], ["strumento_a_scelta", r.strumentiAScelta],
    ] as const) {
      for (const nome of nomi ?? []) competenza.run(id, tipo, nome);
    }
    r.privilegi.forEach((p, ordine) => privilegio.run(id, idPrivilegioUfficiale(db, p), ordine));
  }
}

function aggiornaBackground(db: DatabaseSync) {
  for (const b of BACKGROUND) {
    inserisci(db, "background", {
      nome: b.nome, strumenti_a_scelta: b.strumentiAScelta ?? null, lingue_a_scelta: b.lingueAScelta, mo: b.mo,
      privilegio_id: idPrivilegioUfficiale(db, b.privilegio),
    }, "nome");
  }
  const competenza = db.prepare("INSERT OR IGNORE INTO background_competenze (background_id, tipo, nome) VALUES (?, ?, ?)");
  const oggetto = db.prepare("INSERT INTO background_oggetti (background_id, ordine, nome, qta, peso) VALUES (?, ?, ?, ?, ?)");
  for (const b of BACKGROUND) {
    const riga = db.prepare("SELECT id FROM background WHERE nome = ? AND creato_da IS NULL").get(b.nome);
    if (!riga) continue;
    const id = Number(riga.id);
    db.prepare("DELETE FROM background_competenze WHERE background_id = ?").run(id);
    db.prepare("DELETE FROM background_oggetti WHERE background_id = ?").run(id);
    for (const a of b.abilita) competenza.run(id, "abilita", a);
    for (const s of b.strumenti) competenza.run(id, "strumento", s);
    b.equipaggiamento.forEach((o, ordine) => oggetto.run(id, ordine, o.nome, o.qta, o.peso));
  }
}

// Id della voce con quel nome; se non esiste la si crea come voce dell'utente.
// I campi di una voce esistente non cambiano: valgono quelli del catalogo.
export function idIncantesimo(
  db: DatabaseSync, s: { nome: string; livello: number; scuola: string; tempo: string; scheda?: DettagliIncantesimo },
  utenteId: number,
): number {
  const riga = db.prepare("SELECT id FROM incantesimi WHERE nome = ?").get(s.nome);
  if (riga) return Number(riga.id);
  return inserisci(db, "incantesimi", { ...colonneIncantesimo(s.nome, s.livello, s.scuola, s.tempo, s.scheda), creato_da: utenteId });
}

export function idArma(db: DatabaseSync, a: Arma, utenteId: number): number {
  const riga = db.prepare("SELECT id FROM armi WHERE nome = ?").get(a.nome);
  if (riga) return Number(riga.id);
  return inserisci(db, "armi", { ...colonneArma(a), creato_da: utenteId });
}

export function idArmatura(db: DatabaseSync, a: Armatura, utenteId: number): number {
  const riga = db.prepare("SELECT id FROM armature WHERE nome = ?").get(a.nome);
  if (riga) return Number(riga.id);
  return inserisci(db, "armature", { ...colonneArmatura(a), creato_da: utenteId });
}

export function idPrivilegio(db: DatabaseSync, p: Privilegio, utenteId: number): number {
  const riga = db.prepare("SELECT id FROM privilegi WHERE nome = ? AND fonte = ?").get(p.nome, p.fonte);
  if (riga) return Number(riga.id);
  return inserisci(db, "privilegi", { ...colonnePrivilegio(p), creato_da: utenteId });
}

// --- Lettura ---

export const elencoIncantesimi = (db: DatabaseSync): VoceIncantesimo[] =>
  db.prepare("SELECT * FROM incantesimi ORDER BY livello, nome").all().map(voceIncantesimo);

function elencoRazze(db: DatabaseSync): RazzaCatalogo[] {
  const competenze = (id: number, tipo: string) =>
    db.prepare("SELECT nome FROM razza_competenze WHERE razza_id = ? AND tipo = ? ORDER BY rowid").all(id, tipo).map(r => testo(r.nome));
  return db.prepare(`
    SELECT r.*, m.nome AS madre FROM razze r LEFT JOIN razze m ON m.id = r.razza_madre_id ORDER BY r.id
  `).all().map(r => {
    const id = Number(r.id);
    const bonus: Partial<Record<Caratteristica, number>> = {};
    for (const k of CARATTERISTICHE) {
      const v = Number(r[`bonus_${k.toLowerCase()}`]);
      if (v) bonus[k] = v;
    }
    return {
      nome: testo(r.nome), madre: r.madre === null ? null : testo(r.madre),
      taglia: r.taglia === null ? null : testo(r.taglia), velocita: r.velocita === null ? null : testo(r.velocita),
      bonus, bonusAScelta: Number(r.bonus_a_scelta),
      abilita: competenze(id, "abilita"), abilitaAScelta: Number(r.abilita_a_scelta),
      lingue: competenze(id, "lingua"), lingueAScelta: Number(r.lingue_a_scelta),
      armi: competenze(id, "arma"), armature: competenze(id, "armatura"), strumentiAScelta: competenze(id, "strumento_a_scelta"),
      trucchetto: r.trucchetto === null ? null : testo(r.trucchetto),
      privilegi: db.prepare(`
        SELECT p.* FROM razza_privilegi rp JOIN privilegi p ON p.id = rp.privilegio_id WHERE rp.razza_id = ? ORDER BY rp.ordine
      `).all(id).map(privilegioDaRiga),
    };
  });
}

function elencoBackground(db: DatabaseSync): BackgroundCatalogo[] {
  return db.prepare(`
    SELECT b.*, p.nome AS p_nome, p.fonte AS p_fonte, p.descrizione AS p_descrizione
    FROM background b JOIN privilegi p ON p.id = b.privilegio_id ORDER BY b.nome
  `).all().map(b => {
    const id = Number(b.id);
    const competenze = (tipo: string) =>
      db.prepare("SELECT nome FROM background_competenze WHERE background_id = ? AND tipo = ? ORDER BY rowid").all(id, tipo).map(r => testo(r.nome));
    const scelta = b.strumenti_a_scelta;
    return {
      nome: testo(b.nome), abilita: competenze("abilita"), strumenti: competenze("strumento"),
      strumentiAScelta: scelta === "artigiano" || scelta === "musicale" || scelta === "gioco" ? scelta : null,
      lingueAScelta: Number(b.lingue_a_scelta),
      equipaggiamento: db.prepare("SELECT nome, qta, peso FROM background_oggetti WHERE background_id = ? ORDER BY ordine").all(id)
        .map(o => ({ nome: testo(o.nome), qta: Number(o.qta), peso: Number(o.peso) })),
      mo: Number(b.mo),
      privilegio: { nome: testo(b.p_nome), fonte: testo(b.p_fonte), descrizione: testo(b.p_descrizione) },
    };
  });
}

// Privilegi di classe; con `livello` solo quelli di quel livello, con `fino` tutti quelli fino a quel livello,
// con `sottoclasse` anche i suoi.
export function privilegiDiClasse(
  db: DatabaseSync, filtro: { classe?: string; livello?: number; fino?: number; sottoclasse?: string } = {},
): PrivilegioClasse[] {
  const condizioni: string[] = [];
  const valori: SQLInputValue[] = [];
  if (filtro.classe !== undefined) { condizioni.push("cp.classe = ?"); valori.push(filtro.classe); }
  if (filtro.livello !== undefined) { condizioni.push("cp.livello = ?"); valori.push(filtro.livello); }
  if (filtro.fino !== undefined) { condizioni.push("cp.livello <= ?"); valori.push(filtro.fino); }
  if (filtro.sottoclasse !== undefined) { condizioni.push("(cp.sottoclasse = '' OR cp.sottoclasse = ?)"); valori.push(filtro.sottoclasse); }
  const dove = condizioni.length ? `WHERE ${condizioni.join(" AND ")}` : "";
  return db.prepare(`
    SELECT cp.classe, cp.sottoclasse, cp.livello, p.nome, p.fonte, p.descrizione
    FROM classe_privilegi cp JOIN privilegi p ON p.id = cp.privilegio_id ${dove} ORDER BY cp.livello, cp.sottoclasse <> '', cp.ordine
  `).all(...valori).map(r => ({
    classe: testo(r.classe), sottoclasse: r.sottoclasse === "" ? null : testo(r.sottoclasse), livello: Number(r.livello),
    privilegio: privilegioDaRiga(r),
  }));
}

// Tutto ciò che serve alla procedura di creazione, in una sola risposta.
export function catalogoCreazione(db: DatabaseSync): CatalogoCreazione {
  const classi = new Map<number, string[]>();
  for (const r of db.prepare("SELECT incantesimo_id, classe FROM incantesimo_classi").all()) {
    const id = Number(r.incantesimo_id);
    classi.set(id, [...(classi.get(id) ?? []), testo(r.classe)]);
  }
  return {
    razze: elencoRazze(db),
    background: elencoBackground(db),
    armi: db.prepare("SELECT * FROM armi ORDER BY categoria, nome").all().map(armaDaRiga),
    armature: db.prepare("SELECT * FROM armature ORDER BY ca, nome").all().map(armaturaDaRiga),
    privilegiClasse: privilegiDiClasse(db, { livello: 1 }),
    incantesimi: elencoIncantesimi(db).map((v): IncantesimoCatalogo => ({ ...v, classi: classi.get(v.id) ?? [] })),
  };
}
