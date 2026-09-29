import type { CharacterData } from "./tipi";
import { INITIAL_CHARACTER } from "./dati/alston";
import { CARATTERISTICHE } from "./regole";

export const CHIAVE_SALVATAGGIO = "dnd_alston_character";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const obj = (v: unknown): Obj => (isObj(v) ? v : {});

export const nuovoPersonaggio = (): CharacterData => structuredClone(INITIAL_CHARACTER);

export function carica(): CharacterData {
  try {
    const raw = localStorage.getItem(CHIAVE_SALVATAGGIO);
    if (raw) return daJSON(JSON.parse(raw));
  } catch (e) {
    console.error("Salvataggio non leggibile, uso i dati iniziali", e);
  }
  return nuovoPersonaggio();
}

export function salva(c: CharacterData) {
  try {
    localStorage.setItem(CHIAVE_SALVATAGGIO, JSON.stringify(c));
  } catch (e) {
    console.error("Impossibile salvare la scheda", e);
  }
}

// Accetta sia il formato attuale (versione 2) sia quello vecchio senza versione.
export function daJSON(dati: unknown): CharacterData {
  if (!isObj(dati) || !isObj(dati.info) || !isObj(dati.caratteristiche)) {
    throw new Error("Il file non contiene una scheda personaggio valida.");
  }
  return normalizza(dati.versione === 2 ? dati : migraV1(dati));
}

// Completa le sezioni mancanti con i dati iniziali.
function normalizza(d: Obj): CharacterData {
  const base = nuovoPersonaggio();
  const sezione = <T extends object>(chiave: keyof CharacterData, def: T): T =>
    ({ ...def, ...obj(d[chiave]) }) as T;
  const lista = <T,>(chiave: keyof CharacterData, def: T[]): T[] =>
    (Array.isArray(d[chiave]) ? d[chiave] : def) as T[];

  const caratteristiche = sezione("caratteristiche", base.caratteristiche);
  for (const k of CARATTERISTICHE) caratteristiche[k] = { ...base.caratteristiche[k], ...caratteristiche[k] };
  const slot = lista<number>("slotSpesi", base.slotSpesi);

  return {
    ...base,
    versione: 2,
    info: sezione("info", base.info),
    caratteristiche,
    competenzeAbilita: lista("competenzeAbilita", base.competenzeAbilita),
    combattimento: sezione("combattimento", base.combattimento),
    divinazione: sezione("divinazione", base.divinazione),
    recuperoArcanoUsato: d.recuperoArcanoUsato === true,
    monete: sezione("monete", base.monete),
    xp: sezione("xp", base.xp),
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
  const base = nuovoPersonaggio();
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
