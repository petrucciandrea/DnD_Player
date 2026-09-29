// Regole D&D 5e (edizione 2014) per il Mago.
import type { Arma, Caratteristica, CharacterData, EsitoRiposoBreve } from "./tipi";
import type { SchedaIncantesimo } from "./dati/incantesimi";

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

export interface Danni {
  numero: number;
  facce: number;
  mod: number;
  tipo: string;
}

export function parseDado(espressione: string) {
  const m = /^(\d+)d(\d+)$/.exec(espressione.trim());
  if (!m) throw new Error(`Dado non valido: ${espressione}`);
  return { numero: Number(m[1]), facce: Number(m[2]) };
}

export const testoDanni = (x: Danni) => formulaDanno(`${x.numero}d${x.facce}`, x.mod);

// Con un colpo critico si tirano il doppio dei dadi (il modificatore no).
export const critico = (x: Danni): Danni => ({ ...x, numero: x.numero * 2 });

export function dannoArma(arma: Arma, mod: number, dueMani = false): Danni {
  const dado = parseDado(dueMani && arma.dadoVersatile ? arma.dadoVersatile : arma.dado);
  // "Contundente" → "danni contundenti"
  return { ...dado, mod, tipo: arma.tipoDanno.toLowerCase().replace(/e$/, "i") };
}

// Trucchetti: 1 dado, 2 dal 5° livello, 3 dall'11°, 4 dal 17°.
const moltiplicatoreTrucchetto = (livello: number) => (livello >= 17 ? 4 : livello >= 11 ? 3 : livello >= 5 ? 2 : 1);

export function dannoIncantesimo(s: SchedaIncantesimo, livelloSlot: number, livelloPersonaggio: number): Danni | null {
  if (!s.danni) return null;
  const base = parseDado(s.danni.dado);
  let numero = s.danni.trucchetto ? base.numero * moltiplicatoreTrucchetto(livelloPersonaggio) : base.numero;
  let mod = s.danni.mod ?? 0;
  const sopra = Math.max(0, livelloSlot - s.livello);
  if (s.danni.perLivello && s.livello > 0) numero += parseDado(s.danni.perLivello).numero * sopra;
  if (s.danni.modPerLivello && s.livello > 0) mod += s.danni.modPerLivello * sopra;
  return { numero, facce: base.facce, mod, tipo: s.danni.tipo };
}

export const numeroAttacchi = (s: SchedaIncantesimo, livelloSlot: number) =>
  s.attacco ? s.attacco.numero + (s.attacco.perLivello ?? 0) * Math.max(0, livelloSlot - s.livello) : 0;

// Livelli di slot con almeno uno slot libero, a partire dal livello dell'incantesimo.
export function slotUtilizzabili(c: CharacterData, livelloIncantesimo: number): number[] {
  const { slotMax } = derivate(c);
  return slotMax
    .map((max, i) => ({ livello: i + 1, liberi: max - Math.min(c.slotSpesi[i] ?? 0, max) }))
    .filter(x => x.livello >= livelloIncantesimo && x.liberi > 0)
    .map(x => x.livello);
}

// livelloSlot null = trucchetto o rituale: nessuno slot speso.
// Con `concentrazione` l'incantesimo sostituisce quello su cui ci si stava concentrando.
export function lanciaIncantesimo(
  c: CharacterData, livelloSlot: number | null, opzioni: { concentrazione?: string } = {},
): CharacterData {
  let slotSpesi = c.slotSpesi;
  if (livelloSlot !== null) {
    if (!slotUtilizzabili(c, livelloSlot).includes(livelloSlot)) return c;
    slotSpesi = [...c.slotSpesi];
    slotSpesi[livelloSlot - 1] = (slotSpesi[livelloSlot - 1] ?? 0) + 1;
  }
  if (slotSpesi === c.slotSpesi && !opzioni.concentrazione) return c;
  return { ...c, slotSpesi, concentrazione: opzioni.concentrazione ?? c.concentrazione };
}

// --- Punti ferita, concentrazione e tiri salvezza contro morte ---
export const cdConcentrazione = (danno: number) => Math.max(10, Math.floor(danno / 2));

const TS_MORTE_AZZERATI = { successi: 0, fallimenti: 0 };

export const statoVita = (c: CharacterData) =>
  c.combattimento.pfAttuali > 0 ? "in piedi"
    : c.combattimento.tsMorte.fallimenti >= 3 ? "morto"
    : c.combattimento.stabile ? "stabile"
    : "morente";

// Il danno consuma prima i PF temporanei. Scendere a 0 PF fa perdere la concentrazione;
// subire danni a 0 PF conta come un fallimento; se il danno oltre lo 0 raggiunge i PF massimi è morte istantanea.
export function applicaDanno(c: CharacterData, danno: number): CharacterData {
  const cb = c.combattimento;
  const assorbiti = Math.min(cb.pfTemporanei, danno);
  const resto = danno - assorbiti;
  const pfTemporanei = cb.pfTemporanei - assorbiti;
  if (resto === 0) return { ...c, combattimento: { ...cb, pfTemporanei } };

  if (cb.pfAttuali === 0) {
    const fallimenti = resto >= cb.pfMassimi ? 3 : Math.min(3, cb.tsMorte.fallimenti + 1);
    return { ...c, combattimento: { ...cb, pfTemporanei, stabile: false, tsMorte: { ...cb.tsMorte, fallimenti } } };
  }
  const pf = cb.pfAttuali - resto;
  if (pf > 0) return { ...c, combattimento: { ...cb, pfTemporanei, pfAttuali: pf } };
  return {
    ...c,
    concentrazione: null,
    combattimento: {
      ...cb, pfTemporanei, pfAttuali: 0, stabile: false,
      tsMorte: { successi: 0, fallimenti: -pf >= cb.pfMassimi ? 3 : 0 },
    },
  };
}

export function applicaCura(c: CharacterData, cura: number): CharacterData {
  const cb = c.combattimento;
  if (cura <= 0 || statoVita(c) === "morto") return c;
  return {
    ...c,
    combattimento: {
      ...cb,
      pfAttuali: Math.min(cb.pfMassimi, cb.pfAttuali + cura),
      stabile: false,
      tsMorte: TS_MORTE_AZZERATI,
    },
  };
}

// 20 naturale: torna a 1 PF. 1 naturale: due fallimenti. 10 o più: successo.
// Tre successi: stabile. Tre fallimenti: morto.
export function esitoTsMorte(c: CharacterData, d20: number): CharacterData {
  const cb = c.combattimento;
  if (d20 === 20) return applicaCura(c, 1);
  const { successi, fallimenti } = cb.tsMorte;
  if (d20 >= 10) {
    if (successi + 1 >= 3) return { ...c, combattimento: { ...cb, stabile: true, tsMorte: TS_MORTE_AZZERATI } };
    return { ...c, combattimento: { ...cb, tsMorte: { successi: successi + 1, fallimenti } } };
  }
  return { ...c, combattimento: { ...cb, tsMorte: { successi, fallimenti: Math.min(3, fallimenti + (d20 === 1 ? 2 : 1)) } } };
}

// Il danno non scende mai sotto 0.
export const totaleDanni = (tiri: number[], mod: number) => Math.max(0, tiri.reduce((a, b) => a + b, 0) + mod);

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
      tsMorte: TS_MORTE_AZZERATI,
      stabile: false,
    },
    slotSpesi: c.slotSpesi.map(() => 0),
    divinazione: { presagio, usati: presagio.map(() => false) },
    recuperoArcanoUsato: false,
    concentrazione: null,
  };
}

export function riposoBreve(c: CharacterData, esito: EsitoRiposoBreve): CharacterData {
  const usaRecupero = esito.slotRecuperati.some(n => n > 0);
  const curato = applicaCura(c, esito.pfRecuperati);
  return {
    ...curato,
    combattimento: {
      ...curato.combattimento,
      dadiVitaRimanenti: Math.max(0, c.combattimento.dadiVitaRimanenti - esito.dadiVitaSpesi),
    },
    slotSpesi: c.slotSpesi.map((s, i) => Math.max(0, s - (esito.slotRecuperati[i] ?? 0))),
    recuperoArcanoUsato: c.recuperoArcanoUsato || usaRecupero,
    concentrazione: null, // almeno 1 ora: gli incantesimi di concentrazione di Alston durano meno
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
