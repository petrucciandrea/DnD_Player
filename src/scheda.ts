import type {
  ArmaPersonaggio, Armatura, CategoriaNota, CharacterData, Contatore, EffettoAttivo, NotaSessione,
} from "./tipi.ts";
import { CARATTERISTICHE } from "./regole.ts";
import { regoleClasse } from "./dati/classi.ts";

// Validazione e normalizzazione della scheda, senza dipendenze dal browser:
// la usano sia il client (import JSON, cache locale) sia il server (prima di salvare nell'archivio).

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const obj = (v: unknown): Obj => (isObj(v) ? v : {});
const stringhe = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

const CATEGORIE_ARMATURA = ["leggera", "media", "pesante"] as const;
const CATEGORIE_NOTA: CategoriaNota[] = ["sessione", "png", "obiettivo", "altro"];

const intero = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : fallback);

// Usi spesi per id di risorsa: solo interi positivi.
function risorseUsate(v: unknown): Record<string, number> {
  return Object.fromEntries(
    Object.entries(obj(v)).flatMap(([id, n]) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? [[id, Math.trunc(n)]] : [])),
  );
}

function effettiAttivi(v: unknown): EffettoAttivo[] {
  const visti = new Set<string>();
  return (Array.isArray(v) ? v : []).flatMap((e): EffettoAttivo[] => {
    if (!isObj(e) || typeof e.id !== "string" || visti.has(e.id)) return [];
    visti.add(e.id);
    return [typeof e.valore === "number" && Number.isFinite(e.valore) ? { id: e.id, valore: Math.trunc(e.valore) } : { id: e.id }];
  });
}

// Campi di una nota: solo valori testuali.
const campiNota = (v: unknown): Record<string, string> =>
  Object.fromEntries(Object.entries(obj(v)).filter((x): x is [string, string] => typeof x[1] === "string"));

function noteSessione(v: unknown): NotaSessione[] {
  return (Array.isArray(v) ? v : []).filter(isObj).map((n, i): NotaSessione => ({
    id: intero(n.id, i + 1),
    data: typeof n.data === "string" ? n.data : "",
    categoria: CATEGORIE_NOTA.find(c => c === n.categoria) ?? "altro",
    titolo: typeof n.titolo === "string" ? n.titolo : "",
    testo: typeof n.testo === "string" ? n.testo : "",
    fatto: n.fatto === true,
    campi: campiNota(n.campi),
  }));
}

function contatore(v: unknown): Contatore | null {
  if (!isObj(v) || typeof v.massimo !== "number" || !Number.isFinite(v.massimo) || v.massimo < 1) return null;
  const massimo = Math.trunc(v.massimo);
  return { massimo, rimasti: Math.max(0, Math.min(massimo, intero(v.rimasti, massimo))) };
}

// Armi del personaggio: i vecchi salvataggi non hanno id, bonus, contatori e stato.
function armiPersonaggio(v: unknown): ArmaPersonaggio[] {
  const usati = new Set<number>();
  return (Array.isArray(v) ? v : []).filter(isObj).map((a, i): ArmaPersonaggio => {
    let id = intero(a.id, i + 1);
    while (usati.has(id)) id++;
    usati.add(id);
    const durabilita = contatore(a.durabilita);
    // "danneggiata" vale solo per le armi senza durabilità propria.
    const danneggiata = durabilita ? null : intero(a.danneggiata, -1);
    return {
      ...(a as unknown as ArmaPersonaggio),
      id,
      bonus: intero(a.bonus, 0),
      munizioni: contatore(a.munizioni),
      durabilita,
      danneggiata: danneggiata !== null && danneggiata >= 0 ? danneggiata : null,
      rotta: a.rotta === true,
    };
  });
}

// Solo immagini in data URL e di dimensioni ragionevoli: l'avatar viaggia con la scheda.
const MAX_AVATAR = 300_000; // caratteri
const avatarDa = (v: unknown) =>
  typeof v === "string" && v.length <= MAX_AVATAR && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(v) ? v : "";

function armaturaDa(v: unknown): Armatura | null {
  if (!isObj(v) || typeof v.nome !== "string" || typeof v.ca !== "number") return null;
  const categoria = CATEGORIE_ARMATURA.find(c => c === v.categoria) ?? "leggera";
  return {
    nome: v.nome, categoria, ca: v.ca,
    maxDes: typeof v.maxDes === "number" ? v.maxDes : null,
    forzaMin: num(v.forzaMin, 0),
    svantaggioFurtivita: v.svantaggioFurtivita === true,
    peso: num(v.peso, 0),
  };
}

// Modello generico: un personaggio di 1° livello senza dati. Completa le sezioni che mancano.
export const personaggioVuoto = (): CharacterData => ({
  versione: 2,
  info: {
    nome: "", classe: "", sottoclasse: "", livello: 1, razza: "", background: "", allineamento: "",
    giocatore: "", eta: 0, altezza: "", peso: "", occhi: "", capelli: "", carnagione: "", velocita: "",
    taglia: "Media", ispirazione: false, avatar: "",
  },
  caratteristiche: {
    FOR: { valore: 10, compTS: false },
    DES: { valore: 10, compTS: false },
    COS: { valore: 10, compTS: false },
    INT: { valore: 10, compTS: false },
    SAG: { valore: 10, compTS: false },
    CAR: { valore: 10, compTS: false },
  },
  competenzeAbilita: [],
  competenzeAltre: { lingue: [], strumenti: [], armi: [], armature: [] },
  armatura: null,
  scudo: false,
  combattimento: {
    pfAttuali: 0, pfMassimi: 0, pfTemporanei: 0, dadiVitaRimanenti: 1,
    tsMorte: { successi: 0, fallimenti: 0 }, stabile: false,
  },
  concentrazione: null,
  divinazione: { presagio: [], usati: [] },
  recuperoArcanoUsato: false,
  risorseUsate: {},
  condizioni: [],
  indebolimento: 0,
  effetti: [],
  monete: { mr: 0, ma: 0, me: 0, mo: 0, mp: 0 },
  xp: { totale: 0, storico: [] },
  armi: [],
  slotSpesi: [0, 0, 0, 0, 0, 0, 0, 0, 0],
  incantesimi: [],
  inventario: [],
  privilegi: [],
  note: [],
  lore: { tratti: "", ideali: "", legami: "", difetti: "", backgroundBio: "" },
});

// Un client con una versione vecchia dell'app non conosce i campi aggiunti dopo (per esempio
// taglia o competenzeAltre) e li ometterebbe: i campi assenti, anche dentro `info`, si prendono
// dalla scheda già salvata invece che dai valori predefiniti.
export function completaConEsistente(dati: unknown, esistente: CharacterData | null): unknown {
  if (!isObj(dati) || !esistente) return dati;
  const unito: Obj = { ...esistente, ...dati };
  if (isObj(dati.info)) unito.info = { ...esistente.info, ...dati.info };
  return unito;
}

// Accetta sia il formato attuale (versione 2) sia quello vecchio senza versione.
export function daJSON(dati: unknown): CharacterData {
  if (!isObj(dati) || !isObj(dati.info) || !isObj(dati.caratteristiche)) {
    throw new Error("Il file non contiene una scheda personaggio valida.");
  }
  return normalizza(dati.versione === 2 ? dati : migraV1(dati));
}

// Completa le sezioni mancanti con il modello vuoto. Delle liste tiene solo gli elementi oggetto.
function normalizza(d: Obj): CharacterData {
  const base = personaggioVuoto();
  const sezione = <T extends object>(chiave: keyof CharacterData, def: T): T =>
    ({ ...def, ...obj(d[chiave]) }) as T;
  const lista = <T,>(chiave: keyof CharacterData, def: T[]): T[] =>
    (Array.isArray(d[chiave]) ? d[chiave].filter(isObj) : def) as T[];

  const caratteristiche = sezione("caratteristiche", base.caratteristiche);
  for (const k of CARATTERISTICHE) caratteristiche[k] = { ...base.caratteristiche[k], ...caratteristiche[k] };
  const slot = Array.isArray(d.slotSpesi) ? d.slotSpesi : [];
  const xp = sezione("xp", base.xp);
  const info = sezione("info", base.info);
  // Ogni classe ha almeno una competenza nelle armi: se armi e armature mancano entrambe la scheda
  // viene da una versione che non le salvava, e si prendono quelle della classe.
  const competenze = obj(d.competenzeAltre);
  let armi = stringhe(competenze.armi);
  let armature = stringhe(competenze.armature);
  const regole = regoleClasse(typeof info.classe === "string" ? info.classe : "");
  if (armi.length === 0 && armature.length === 0 && regole) {
    armi = [...regole.armi];
    armature = [...regole.armature];
  }

  return {
    ...base,
    versione: 2,
    info: { ...info, avatar: avatarDa(info.avatar) },
    caratteristiche,
    competenzeAbilita: stringhe(d.competenzeAbilita),
    competenzeAltre: {
      lingue: stringhe(competenze.lingue),
      strumenti: stringhe(competenze.strumenti),
      armi,
      armature,
    },
    armatura: armaturaDa(d.armatura),
    scudo: d.scudo === true,
    combattimento: sezione("combattimento", base.combattimento),
    concentrazione: typeof d.concentrazione === "string" ? d.concentrazione : null,
    divinazione: sezione("divinazione", base.divinazione),
    recuperoArcanoUsato: d.recuperoArcanoUsato === true,
    risorseUsate: risorseUsate(d.risorseUsate),
    condizioni: [...new Set(stringhe(d.condizioni))],
    indebolimento: Math.max(0, Math.min(6, intero(d.indebolimento, 0))),
    effetti: effettiAttivi(d.effetti),
    monete: sezione("monete", base.monete),
    xp: { ...xp, storico: Array.isArray(xp.storico) ? xp.storico.filter(isObj) : [] } as CharacterData["xp"],
    armi: armiPersonaggio(d.armi),
    slotSpesi: Array.from({ length: 9 }, (_, i) => num(slot[i], 0)),
    incantesimi: lista("incantesimi", base.incantesimi),
    inventario: lista("inventario", base.inventario),
    privilegi: lista("privilegi", base.privilegi),
    note: noteSessione(d.note),
    lore: sezione("lore", base.lore),
  };
}

// Formato della prima versione: mod/ts memorizzati, slot solo di 1° e 2° livello,
// bonusCompetenza e prossimoLivello scritti a mano, armi come stringhe.
function migraV1(d: Obj): Obj {
  const base = personaggioVuoto();
  const info = { ...obj(d.info) };
  delete info.bonusCompetenza;

  const vecchieCar = obj(d.caratteristiche);
  const caratteristiche = Object.fromEntries(CARATTERISTICHE.map(k => {
    const v = obj(vecchieCar[k]);
    return [k, { valore: num(v.valore, base.caratteristiche[k].valore), compTS: v.compTS === true }];
  }));

  const comb = obj(d.combattimento);
  const slot = obj(d.slot);
  const spesi = (k: string) => num(obj(slot[k]).spesi, 0);
  const xp = obj(d.xp);

  const incantesimi = Array.isArray(d.incantesimi)
    ? d.incantesimi.filter(isObj).map(vecchio => {
        const s = { ...vecchio };
        delete s.nelGrimorio;
        // Correzione: Dardo di Fuoco è di Invocazione (Evocation), non Evocazione.
        if (s.nome === "Dardo di Fuoco" && s.scuola === "Evocazione") s.scuola = "Invocazione";
        return s;
      })
    : base.incantesimi;

  return {
    versione: 2,
    info: { ...info, ispirazione: num(info.ispirazione, 0) > 0 },
    caratteristiche,
    combattimento: {
      pfAttuali: num(comb.pfAttuali, base.combattimento.pfAttuali),
      pfMassimi: num(comb.pfMassimi, base.combattimento.pfMassimi),
      pfTemporanei: num(comb.pfTemporanei, 0),
      dadiVitaRimanenti: num(comb.dadiVitaRimanenti, base.combattimento.dadiVitaRimanenti),
    },
    divinazione: d.divinazione,
    monete: d.monete,
    xp: { totale: num(xp.totale, base.xp.totale), storico: Array.isArray(xp.storico) ? xp.storico : base.xp.storico },
    slotSpesi: [spesi("livello1"), spesi("livello2")],
    incantesimi,
    inventario: d.inventario,
    lore: d.lore,
  };
}
