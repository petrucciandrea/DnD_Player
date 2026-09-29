// Regole D&D 5e (edizione 2014) per il Mago.
import type { Arma, Caratteristica, CharacterData, EsitoRiposoBreve } from "./tipi";

export const CARATTERISTICHE: Caratteristica[] = ["FOR", "DES", "COS", "INT", "SAG", "CAR"];

export const ABILITA: { id: string; nome: string; car: Caratteristica }[] = [
  { id: "acrobazia", nome: "Acrobazia", car: "DES" },
  { id: "addestrareAnimali", nome: "Addestrare Animali", car: "SAG" },
  { id: "arcano", nome: "Arcano", car: "INT" },
  { id: "atletica", nome: "Atletica", car: "FOR" },
  { id: "furtivita", nome: "Furtività", car: "DES" },
  { id: "indagare", nome: "Indagare", car: "INT" },
  { id: "inganno", nome: "Inganno", car: "CAR" },
  { id: "intimidire", nome: "Intimidire", car: "CAR" },
  { id: "intrattenere", nome: "Intrattenere", car: "CAR" },
  { id: "intuizione", nome: "Intuizione", car: "SAG" },
  { id: "medicina", nome: "Medicina", car: "SAG" },
  { id: "natura", nome: "Natura", car: "INT" },
  { id: "percezione", nome: "Percezione", car: "SAG" },
  { id: "persuasione", nome: "Persuasione", car: "CAR" },
  { id: "rapiditaDiMano", nome: "Rapidità di Mano", car: "DES" },
  { id: "religione", nome: "Religione", car: "INT" },
  { id: "sopravvivenza", nome: "Sopravvivenza", car: "SAG" },
  { id: "storia", nome: "Storia", car: "INT" },
];

// Terminologia italiana: Invocazione = Evocation, Evocazione = Conjuration.
export const SCUOLE = [
  "Abiurazione", "Ammaliamento", "Divinazione", "Evocazione",
  "Illusione", "Invocazione", "Necromanzia", "Trasmutazione",
];

// XP necessari per raggiungere il livello (indice = livello - 1).
const SOGLIE_XP = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
  85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000,
];

// Slot incantesimo del Mago per livello del personaggio (indice = livello - 1).
const SLOT_MAGO: number[][] = [
  [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2],
  [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

const LIVELLI_AUMENTO_CARATTERISTICHE = [4, 8, 12, 16, 19];

export const tiraD = (facce: number) => Math.floor(Math.random() * facce) + 1;

export type Modalita = "normale" | "vantaggio" | "svantaggio";

// Con vantaggio si tiene il d20 più alto, con svantaggio il più basso.
export const risultatoD20 = (tiri: number[], modalita: Modalita) =>
  modalita === "vantaggio" ? Math.max(...tiri) : modalita === "svantaggio" ? Math.min(...tiri) : tiri[0];

export const modificatore = (valore: number) => Math.floor((valore - 10) / 2);
export const bonusCompetenza = (livello: number) => Math.ceil(livello / 4) + 1;
export const segno = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
export const formulaDanno = (dado: string, mod: number) =>
  mod === 0 ? dado : `${dado} ${mod > 0 ? "+" : "-"} ${Math.abs(mod)}`;

// PF guadagnati a ogni livello dal 2° in poi (media del d6 = 4).
const pfPerLivello = (modCOS: number) => Math.max(1, 4 + modCOS);

export function derivate(c: CharacterData) {
  const liv = c.info.livello;
  const comp = bonusCompetenza(liv);
  const mod = (k: Caratteristica) => modificatore(c.caratteristiche[k].valore);
  const ts = (k: Caratteristica) => mod(k) + (c.caratteristiche[k].compTS ? comp : 0);
  const abilita = (id: string) => {
    const a = ABILITA.find(x => x.id === id);
    if (!a) return 0;
    return mod(a.car) + (c.competenzeAbilita.includes(id) ? comp : 0);
  };
  const attaccoArma = (arma: Arma) => {
    const m = arma.accurata ? Math.max(mod("FOR"), mod("DES")) : mod("FOR");
    return { bonus: m + comp, mod: m };
  };
  const prossimaSoglia = liv < 20 ? SOGLIE_XP[liv] : null;

  return {
    comp,
    mod,
    ts,
    abilita,
    attaccoArma,
    ca: 10 + mod("DES"), // senza armatura
    iniziativa: mod("DES"),
    percezionePassiva: 10 + abilita("percezione"),
    cdMagia: 8 + comp + mod("INT"),
    attaccoMagico: comp + mod("INT"),
    maxPreparabili: Math.max(1, liv + mod("INT")),
    preparatiAttuali: c.incantesimi.filter(s => s.livello > 0 && s.preparato).length,
    maxTrucchetti: liv >= 10 ? 5 : liv >= 4 ? 4 : 3,
    trucchettiAttuali: c.incantesimi.filter(s => s.livello === 0).length,
    slotMax: SLOT_MAGO[liv - 1] ?? [],
    pesoTotale: c.inventario.reduce((acc, it) => acc + it.peso * it.qta, 0),
    capacitaCarico: c.caratteristiche.FOR.valore * 15,
    prossimaSoglia,
    puoSalire: prossimaSoglia !== null && c.xp.totale >= prossimaSoglia,
    dadiPresagio: liv >= 14 ? 3 : 2, // Presagio Superiore al 14°
    budgetRecuperoArcano: Math.ceil(liv / 2),
    dadiVitaRecuperati: Math.max(1, Math.floor(liv / 2)),
  };
}

export type Derivate = ReturnType<typeof derivate>;

export function riposoLungo(c: CharacterData, presagio: number[]): CharacterData {
  const d = derivate(c);
  return {
    ...c,
    combattimento: {
      ...c.combattimento,
      pfAttuali: c.combattimento.pfMassimi,
      dadiVitaRimanenti: Math.min(c.info.livello, c.combattimento.dadiVitaRimanenti + d.dadiVitaRecuperati),
    },
    slotSpesi: c.slotSpesi.map(() => 0),
    divinazione: { presagio, usati: presagio.map(() => false) },
    recuperoArcanoUsato: false,
  };
}

export function riposoBreve(c: CharacterData, esito: EsitoRiposoBreve): CharacterData {
  const usaRecupero = esito.slotRecuperati.some(n => n > 0);
  return {
    ...c,
    combattimento: {
      ...c.combattimento,
      pfAttuali: Math.min(c.combattimento.pfMassimi, c.combattimento.pfAttuali + esito.pfRecuperati),
      dadiVitaRimanenti: Math.max(0, c.combattimento.dadiVitaRimanenti - esito.dadiVitaSpesi),
    },
    slotSpesi: c.slotSpesi.map((s, i) => Math.max(0, s - (esito.slotRecuperati[i] ?? 0))),
    recuperoArcanoUsato: c.recuperoArcanoUsato || usaRecupero,
  };
}

export function saliDiLivello(c: CharacterData): CharacterData {
  const pf = pfPerLivello(modificatore(c.caratteristiche.COS.valore));
  return {
    ...c,
    info: { ...c.info, livello: c.info.livello + 1 },
    combattimento: {
      ...c.combattimento,
      pfMassimi: c.combattimento.pfMassimi + pf,
      pfAttuali: c.combattimento.pfAttuali + pf,
      dadiVitaRimanenti: c.combattimento.dadiVitaRimanenti + 1,
    },
  };
}

export const haAumentoCaratteristiche = (livello: number) =>
  LIVELLI_AUMENTO_CARATTERISTICHE.includes(livello);

// Cambiare la COS modifica retroattivamente i PF massimi (1 PF per livello per punto di modificatore).
export function modificaCaratteristica(c: CharacterData, k: Caratteristica, delta: number): CharacterData {
  const vecchio = c.caratteristiche[k].valore;
  const nuovo = Math.max(1, Math.min(30, vecchio + delta));
  let combattimento = c.combattimento;
  if (k === "COS") {
    const diff = (modificatore(nuovo) - modificatore(vecchio)) * c.info.livello;
    const pfMassimi = c.combattimento.pfMassimi + diff;
    combattimento = {
      ...c.combattimento,
      pfMassimi,
      pfAttuali: Math.max(0, Math.min(pfMassimi, c.combattimento.pfAttuali + diff)),
    };
  }
  return {
    ...c,
    caratteristiche: { ...c.caratteristiche, [k]: { ...c.caratteristiche[k], valore: nuovo } },
    combattimento,
  };
}
