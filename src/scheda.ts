import type { CharacterData } from "./tipi";
import { CARATTERISTICHE } from "./regole";

// Validazione e normalizzazione della scheda, senza dipendenze dal browser:
// la usano sia il client (import JSON, cache locale) sia il server (prima di salvare nell'archivio).

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const obj = (v: unknown): Obj => (isObj(v) ? v : {});

// Modello generico: un personaggio di 1° livello senza dati. Completa le sezioni che mancano.
export const personaggioVuoto = (): CharacterData => ({
  versione: 2,
  info: {
    nome: "", classe: "", sottoclasse: "", livello: 1, razza: "", background: "", allineamento: "",
    giocatore: "", eta: 0, altezza: "", peso: "", occhi: "", capelli: "", carnagione: "", velocita: "",
    ispirazione: false,
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
  combattimento: {
    pfAttuali: 0, pfMassimi: 0, pfTemporanei: 0, dadiVitaRimanenti: 1,
    tsMorte: { successi: 0, fallimenti: 0 }, stabile: false,
  },
  concentrazione: null,
  divinazione: { presagio: [], usati: [] },
  recuperoArcanoUsato: false,
  monete: { mr: 0, ma: 0, me: 0, mo: 0, mp: 0 },
  xp: { totale: 0, storico: [] },
  armi: [],
  slotSpesi: [0, 0, 0, 0, 0, 0, 0, 0, 0],
  incantesimi: [],
  inventario: [],
  privilegi: [],
  lore: { tratti: "", ideali: "", legami: "", difetti: "", backgroundBio: "" },
});

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

  return {
    ...base,
    versione: 2,
    info: sezione("info", base.info),
    caratteristiche,
    competenzeAbilita: Array.isArray(d.competenzeAbilita) ? d.competenzeAbilita.filter(a => typeof a === "string") : [],
    combattimento: sezione("combattimento", base.combattimento),
    concentrazione: typeof d.concentrazione === "string" ? d.concentrazione : null,
    divinazione: sezione("divinazione", base.divinazione),
    recuperoArcanoUsato: d.recuperoArcanoUsato === true,
    monete: sezione("monete", base.monete),
    xp: { ...xp, storico: Array.isArray(xp.storico) ? xp.storico.filter(isObj) : [] } as CharacterData["xp"],
    armi: lista("armi", base.armi),
    slotSpesi: Array.from({ length: 9 }, (_, i) => num(slot[i], 0)),
    incantesimi: lista("incantesimi", base.incantesimi),
    inventario: lista("inventario", base.inventario),
    privilegi: lista("privilegi", base.privilegi),
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
