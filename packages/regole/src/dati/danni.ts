import type { CharacterData, TipoDifesa } from "../tipi.ts";
import { condizione, effetto } from "./condizioni.ts";

// Tipi di danno, resistenze, immunità e vulnerabilità (5e 2014). Le difese si derivano da condizioni,
// effetti attivi, privilegi di razza e di classe e dalla lista personale della scheda (`difese`).
// Senza import da regole.ts, come condizioni.ts.

export const TIPI_DANNO = [
  { id: "acido", nome: "Acido" },
  { id: "contundente", nome: "Contundente" },
  { id: "forza", nome: "Forza" },
  { id: "freddo", nome: "Freddo" },
  { id: "fulmine", nome: "Fulmine" },
  { id: "fuoco", nome: "Fuoco" },
  { id: "necrotico", nome: "Necrotico" },
  { id: "perforante", nome: "Perforante" },
  { id: "psichico", nome: "Psichico" },
  { id: "radioso", nome: "Radioso" },
  { id: "tagliente", nome: "Tagliente" },
  { id: "tuono", nome: "Tuono" },
  { id: "veleno", nome: "Veleno" },
] as const;

export type TipoDanno = (typeof TIPI_DANNO)[number]["id"];

export const FISICI: TipoDanno[] = ["contundente", "perforante", "tagliente"];

export const nomeTipoDanno = (t: TipoDanno) => TIPI_DANNO.find(x => x.id === t)?.nome ?? t;

// Radice di ogni tipo, per riconoscere "da fuoco", "Contundenti", "necrotici"...
const RADICI: [string, TipoDanno][] = [
  ["acid", "acido"], ["contundent", "contundente"], ["forz", "forza"], ["fredd", "freddo"], ["fulmin", "fulmine"],
  ["fuoc", "fuoco"], ["necrotic", "necrotico"], ["perforant", "perforante"], ["psichic", "psichico"],
  ["radios", "radioso"], ["taglient", "tagliente"], ["tuon", "tuono"], ["velen", "veleno"],
];

// Il primo tipo di danno nominato nel testo (null se nessuno).
export function tipoDanno(testo: string): TipoDanno | null {
  const parole = testo.toLowerCase().split(/[^a-zàèéìòù]+/);
  for (const parola of parole) {
    const trovato = RADICI.find(([radice]) => parola.startsWith(radice));
    if (trovato) return trovato[1];
  }
  return null;
}

export const TIPI_DIFESA: { id: TipoDifesa; nome: string }[] = [
  { id: "resistenza", nome: "Resistenza" },
  { id: "immunita", nome: "Immunità" },
  { id: "vulnerabilita", nome: "Vulnerabilità" },
];

export const nomeTipoDifesa = (t: TipoDifesa) => TIPI_DIFESA.find(x => x.id === t)?.nome ?? t;

// Antenato del Dragonide: colore → tipo del soffio e della resistenza (lo usa anche semi/razze.ts).
export const DANNO_ANTENATO: Record<string, TipoDanno> = {
  Argento: "freddo", Bianco: "freddo", Blu: "fulmine", Bronzo: "fulmine", Nero: "acido",
  Oro: "fuoco", Ottone: "fuoco", Rame: "acido", Rosso: "fuoco", Verde: "veleno",
};

export interface Difesa {
  tipo: TipoDifesa;
  danni: TipoDanno[] | "tutti";
  fonte: string;
  soloNonMagiche?: boolean; // solo contro i danni fisici di attacchi non magici
  soloIncantesimi?: boolean; // solo contro i danni degli incantesimi
  personale?: boolean; // dalla lista della scheda (`difese`), non derivata
}

// Difese che vengono da un privilegio di razza, riconosciuto per nome.
const DIFESE_DI_RAZZA: Record<string, Omit<Difesa, "fonte">> = {
  "Resilienza Nanica": { tipo: "resistenza", danni: ["veleno"] },
  "Resilienza dei Tozzi": { tipo: "resistenza", danni: ["veleno"] },
  "Resistenza Infernale": { tipo: "resistenza", danni: ["fuoco"] },
};

// Difese che vengono dalla classe o dalla sottoclasse, riconosciute da classe, sottoclasse e livello.
const DIFESE_DI_CLASSE: { classe: string; sottoclasse?: string; livello: number; difesa: Difesa }[] = [
  { classe: "Monaco", livello: 10, difesa: { tipo: "immunita", danni: ["veleno"], fonte: "Purezza del Corpo" } },
  { classe: "Druido", sottoclasse: "Circolo della Terra", livello: 10,
    difesa: { tipo: "immunita", danni: ["veleno"], fonte: "Protezione della Natura" } },
  { classe: "Mago", sottoclasse: "Scuola di Necromanzia", livello: 10,
    difesa: { tipo: "resistenza", danni: ["necrotico"], fonte: "Assuefatto alla Non Morte" } },
  { classe: "Mago", sottoclasse: "Scuola di Abiurazione", livello: 14,
    difesa: { tipo: "resistenza", danni: "tutti", soloIncantesimi: true, fonte: "Resistenza agli Incantesimi" } },
  { classe: "Warlock", sottoclasse: "Il Grande Antico", livello: 10,
    difesa: { tipo: "resistenza", danni: ["psichico"], fonte: "Scudo Mentale" } },
  { classe: "Chierico", sottoclasse: "Dominio della Guerra", livello: 17,
    difesa: { tipo: "resistenza", danni: FISICI, soloNonMagiche: true, fonte: "Avatar della Battaglia" } },
  { classe: "Paladino", sottoclasse: "Giuramento degli Antichi", livello: 7,
    difesa: { tipo: "resistenza", danni: "tutti", soloIncantesimi: true, fonte: "Aura di Guardia" } },
];

type StatoDifese = Pick<CharacterData, "condizioni" | "effetti" | "privilegi" | "difese"> & {
  info: Pick<CharacterData["info"], "classe" | "sottoclasse" | "livello" | "razza">;
};

export function difeseDelPersonaggio(c: StatoDifese): Difesa[] {
  const difese: Difesa[] = [];
  for (const id of c.condizioni) {
    const def = condizione(id);
    for (const d of def?.difese ?? []) difese.push({ ...d, fonte: def!.nome });
  }
  for (const attivo of c.effetti) {
    const def = effetto(attivo.id);
    for (const d of def?.difese ?? []) difese.push({ ...d, fonte: def!.nome });
  }
  for (const p of c.privilegi) {
    const razza = DIFESE_DI_RAZZA[p.nome];
    if (razza) difese.push({ ...razza, fonte: p.nome });
    if (p.nome === "Antenato Draconico") {
      // La fonte è la sottorazza, "Dragonide (Rosso)"; in mancanza vale la razza del personaggio.
      const colore = /\(([^)]+)\)/.exec(p.fonte)?.[1] ?? /\(([^)]+)\)/.exec(c.info.razza)?.[1];
      const danno = colore ? DANNO_ANTENATO[colore] : undefined;
      if (danno) difese.push({ tipo: "resistenza", danni: [danno], fonte: p.nome });
    }
  }
  const { classe, sottoclasse, livello } = c.info;
  for (const r of DIFESE_DI_CLASSE) {
    if (r.classe === classe && (!r.sottoclasse || r.sottoclasse === sottoclasse) && livello >= r.livello) difese.push(r.difesa);
  }
  for (const d of c.difese) difese.push({ tipo: d.tipo, danni: [d.danno], fonte: d.nota.trim() || "Personale", personale: true });
  return difese;
}

// Schivata Prodigiosa (Ladro dal 5°): con una reazione dimezza i danni di un attacco.
export const haSchivataProdigiosa = (c: { info: Pick<CharacterData["info"], "classe" | "livello"> }) =>
  c.info.classe === "Ladro" && c.info.livello >= 5;

export interface ParteDanno {
  quantita: number;
  tipo: TipoDanno;
  magico?: boolean; // attacco con un'arma magica
  incantesimo?: boolean; // danno di un incantesimo
}

export interface EsitoParte {
  quantita: number;
  finale: number;
  note: string[];
}

const siApplica = (d: Difesa, p: ParteDanno) =>
  (d.danni === "tutti" || d.danni.includes(p.tipo))
  && (!d.soloNonMagiche || (FISICI.includes(p.tipo) && !p.magico && !p.incantesimo))
  && (!d.soloIncantesimi || p.incantesimo === true);

// Prima i modificatori (Schivata Prodigiosa), poi l'immunità, la resistenza (metà, per difetto) e la vulnerabilità
// (doppio). Più difese dello stesso genere contano una volta sola.
export function calcolaDanno(difese: Difesa[], parti: ParteDanno[], opzioni: { dimezza?: boolean } = {}) {
  const esiti = parti.map((p): EsitoParte => {
    const quantita = Math.max(0, Math.trunc(p.quantita) || 0);
    const note: string[] = [];
    let n = quantita;
    const passo = (nome: string, nuovo: number) => {
      note.push(`${nome}: ${n} → ${nuovo}`);
      n = nuovo;
    };
    if (opzioni.dimezza && n > 0) passo("Schivata Prodigiosa", Math.floor(n / 2));
    const fonti = (tipo: TipoDifesa) => difese.filter(d => d.tipo === tipo && siApplica(d, p)).map(d => d.fonte);
    const immunita = fonti("immunita");
    if (immunita.length > 0) {
      if (n > 0) passo(`Immunità (${immunita.join(", ")})`, 0);
      return { quantita, finale: 0, note };
    }
    const resistenze = fonti("resistenza");
    if (resistenze.length > 0 && n > 0) passo(`Resistenza (${resistenze.join(", ")})`, Math.floor(n / 2));
    const vulnerabilita = fonti("vulnerabilita");
    if (vulnerabilita.length > 0 && n > 0) passo(`Vulnerabilità (${vulnerabilita.join(", ")})`, n * 2);
    return { quantita, finale: n, note };
  });
  return { totale: esiti.reduce((acc, e) => acc + e.finale, 0), parti: esiti };
}

// Etichetta breve di una difesa per la card della scheda: "Resistenza: fuoco (Resistenza Infernale)".
export function testoDifesa(d: Difesa) {
  const danni = d.danni === "tutti" ? "tutti i danni" : d.danni.map(t => nomeTipoDanno(t).toLowerCase()).join(", ");
  const limite = d.soloNonMagiche ? " non magici" : d.soloIncantesimi ? " degli incantesimi" : "";
  return `${nomeTipoDifesa(d.tipo)}: ${danni}${limite}`;
}
