// Regole D&D 5e (edizione 2014). Le regole delle singole classi stanno in dati/classi.ts.
import type {
  Arma, ArmaPersonaggio, Caratteristica, CharacterData, DettagliIncantesimo, EsitoRiposoBreve, IncantesimoCatalogo, Privilegio, PrivilegioClasse, Spell,
} from "./tipi.ts";
import { CARATTERISTICA_MAGICA_RAZZIALE, classeDellaLista, incantatoreDi, regoleClasse, type Incantatore } from "./dati/classi.ts";
import { bonusIra, risorseDelPersonaggio } from "./dati/risorse.ts";
import { EFFETTI, condizione, effetto, type DefinizioneEffetto } from "./dati/condizioni.ts";
import { competenteArma, competenteArmatura } from "./dati/competenze.ts";
import { FONTE_STILE, STILI, haScelto, scelteDelPersonaggio, totaleScelte, type DefinizioneScelta } from "./dati/scelte.ts";
import { COSTO_SLOT_STREGONERIA, metamagia } from "./dati/metamagia.ts";
import { incantesimiDiSottoclasse } from "./dati/incantesimiSottoclasse.ts";

// Quanto serve per calcolare danni e attacchi di un incantesimo lanciato con un certo slot.
type IncantesimoDaLanciare = { livello: number } & Pick<DettagliIncantesimo, "danni" | "attacco">;

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

// Slot incantesimo per livello del personaggio (indice = livello - 1).
// Incantatori completi: Bardo, Chierico, Druido, Mago, Stregone.
const SLOT_COMPLETO: number[][] = [
  [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2],
  [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

// Mezzi incantatori (Paladino, Ranger): niente slot al 1° livello.
const SLOT_MEZZO: number[][] = [
  [], [2], [3], [3], [4, 2], [4, 2], [4, 3], [4, 3], [4, 3, 2], [4, 3, 2],
  [4, 3, 3], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 2],
  [4, 3, 3, 3, 1], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2],
];

// Terzi incantatori (Cavaliere Mistico, Mistificatore Arcano): dal 3° livello.
const SLOT_TERZO: number[][] = [
  [], [], [2], [3], [3], [3], [4, 2], [4, 2], [4, 2], [4, 3],
  [4, 3], [4, 3], [4, 3, 2], [4, 3, 2], [4, 3, 2], [4, 3, 3],
  [4, 3, 3], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 1],
];

// Magia del patto (Warlock): pochi slot, tutti dello stesso livello, recuperati anche con il riposo breve.
export function slotPatto(livello: number) {
  const numero = livello >= 17 ? 4 : livello >= 11 ? 3 : livello >= 2 ? 2 : 1;
  const livelloSlot = Math.min(5, Math.ceil(livello / 2));
  return { numero, livelloSlot };
}

// Slot massimi per livello di slot (indice 0 = 1° livello). Per il patto solo il livello degli slot ne ha.
export function slotMassimi(inc: Incantatore | null, livello: number): number[] {
  if (!inc) return [];
  if (inc.tipo === "patto") {
    const { numero, livelloSlot } = slotPatto(livello);
    return Array.from({ length: livelloSlot }, (_, i) => (i === livelloSlot - 1 ? numero : 0));
  }
  const tabella = inc.tipo === "completo" ? SLOT_COMPLETO : inc.tipo === "mezzo" ? SLOT_MEZZO : SLOT_TERZO;
  return tabella[livello - 1] ?? [];
}

const LIVELLI_AUMENTO_CARATTERISTICHE = [4, 8, 12, 16, 19];

// Il livello di slot più alto che l'incantatore ha a quel livello (0 = nessuno).
export function livelloMassimoIncantesimi(inc: Incantatore | null, livello: number): number {
  const slot = slotMassimi(inc, livello);
  return slot.reduce((max, n, i) => (n > 0 ? i + 1 : max), 0);
}

export const PESO_SCUDO = 6; // lb

// Privilegi che cambiano i calcoli, riconosciuti per nome.
const haPrivilegio = (c: CharacterData, nome: string) => c.privilegi.some(p => p.nome === nome);

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

// Una parte dei danni: i danni di un colpo possono averne più di una (arma + Attacco Furtivo, Punizione Divina...).
export interface Danni {
  numero: number; // 0 = danno fisso (colpo senz'armi di chi non è monaco)
  facce: number;
  mod: number;
  tipo: string;
  etichetta?: string; // da dove vengono, per le parti aggiunte all'arma
}

export function parseDado(espressione: string) {
  const m = /^(\d+)d(\d+)$/.exec(espressione.trim());
  if (!m) throw new Error(`Dado non valido: ${espressione}`);
  return { numero: Number(m[1]), facce: Number(m[2]) };
}

const testoParte = (x: Danni) => (x.numero === 0 ? String(x.mod) : formulaDanno(`${x.numero}d${x.facce}`, x.mod));

// Più parti si scrivono una dopo l'altra: "1d8 + 3 + 2d6".
export const testoDanni = (x: Danni | Danni[]) => (Array.isArray(x) ? x.map(testoParte).join(" + ") : testoParte(x));

// "1d8 + 3 danni taglienti + 2d6 danni perforanti (Attacco Furtivo)"
export const descrizioneDanni = (parti: Danni[]) =>
  parti.map(p => `${testoParte(p)} danni ${p.tipo}${p.etichetta ? ` (${p.etichetta})` : ""}`).join(" + ");

// Con un colpo critico si tirano il doppio dei dadi (il modificatore no).
export const critico = (x: Danni): Danni => ({ ...x, numero: x.numero * 2 });

// Critico di un colpo in più parti: raddoppiano i dadi di tutte; `dadiExtra` (Critico Brutale)
// aggiunge dadi dell'arma alla prima parte.
export const dannoCritico = (parti: Danni[], dadiExtra = 0): Danni[] =>
  parti.map((p, i) => ({ ...critico(p), numero: p.numero * 2 + (i === 0 && p.numero > 0 ? dadiExtra : 0) }));

// "Contundente" → "danni contundenti"
const tipoDanni = (tipoArma: string) => tipoArma.toLowerCase().replace(/e$/, "i");

export function dannoArma(arma: Arma, mod: number, dueMani = false): Danni {
  const dado = parseDado(dueMani && arma.dadoVersatile ? arma.dadoVersatile : arma.dado);
  return { ...dado, mod, tipo: tipoDanni(arma.tipoDanno) };
}

// Il colpo senz'armi: tutti ne sono competenti. Fa 1 + FOR (0d1 = nessun dado), o il dado delle Arti Marziali.
export const COLPO_SENZA_ARMI: ArmaPersonaggio = {
  id: -1, nome: "Colpo senz'armi", dado: "0d1", tipoDanno: "Contundente", proprieta: "", accurata: false, categoria: "semplice",
  bonus: 0, munizioni: null, durabilita: null, danneggiata: null, rotta: false,
};
const eColpoSenzaArmi = (a: Arma) => a.nome === COLPO_SENZA_ARMI.nome;

// --- Privilegi di classe che cambiano attacchi e danni ---
// Si riconoscono da classe, sottoclasse e livello (come le risorse), così valgono anche se la scheda non ha il privilegio.

type InfoClasse = Pick<CharacterData, "info">;
const eClasse = (c: InfoClasse, classe: string, livello = 1, sottoclasse?: string) =>
  c.info.classe === classe && c.info.livello >= livello && (sottoclasse === undefined || c.info.sottoclasse === sottoclasse);

// Attacco Extra: quanti attacchi con l'azione di Attacco.
export function attacchiPerAzione(c: InfoClasse): number {
  const liv = c.info.livello;
  if (c.info.classe === "Guerriero") return liv >= 20 ? 4 : liv >= 11 ? 3 : liv >= 5 ? 2 : 1;
  if (["Barbaro", "Monaco", "Paladino", "Ranger"].includes(c.info.classe) && liv >= 5) return 2;
  if (eClasse(c, "Bardo", 6, "Collegio del Valore")) return 2;
  return 1;
}

// Critico Migliorato e Critico Superiore del Campione: il d20 minimo per un colpo critico con un'arma.
export const sogliaCritico = (c: InfoClasse) =>
  eClasse(c, "Guerriero", 15, "Campione") ? 18 : eClasse(c, "Guerriero", 3, "Campione") ? 19 : 20;

// Critico Brutale del Barbaro: dadi dell'arma in più su un critico in mischia.
export const dadiCriticoBrutale = (c: InfoClasse) =>
  !eClasse(c, "Barbaro", 9) ? 0 : c.info.livello >= 17 ? 3 : c.info.livello >= 13 ? 2 : 1;

// Arti Marziali del Monaco: d4, d6 dal 5°, d8 dall'11°, d10 dal 17°.
export const dadoArtiMarziali = (livello: number) => (livello >= 17 ? 10 : livello >= 11 ? 8 : livello >= 5 ? 6 : 4);

// Armi da monaco: spada corta e armi semplici da mischia senza "Pesante" né "Due mani" (più il colpo senz'armi).
export const armaDaMonaco = (a: Arma) =>
  eColpoSenzaArmi(a) || a.nome === "Spada Corta"
  || (a.categoria === "semplice" && !a.distanza && !/pesante|due mani/i.test(a.proprieta));

export const dadiAttaccoFurtivo = (livello: number) => Math.ceil(livello / 2);

// Punizione Divina: 2d8 con uno slot di 1°, +1d8 per livello in più (massimo 5d8), +1d8 contro immondi e non morti.
export function dannoPunizione(livelloSlot: number, controImmondi = false): Danni {
  const numero = Math.min(5, livelloSlot + 1) + (controImmondi ? 1 : 0);
  return { numero, facce: 8, mod: 0, tipo: "radiosi", etichetta: "Punizione Divina" };
}

// Danni che si aggiungono a un colpo andato a segno con l'arma. `facoltativa`: il giocatore sceglie se applicarli
// (una volta per turno, o spendendo uno slot se `slot`).
export interface DannoExtra {
  id: string;
  etichetta: string;
  danni: Danni;
  facoltativa: boolean;
  slot?: boolean; // si spende uno slot: i danni dipendono dal suo livello (dannoPunizione)
  nota?: string;
}

export function danniExtraArma(c: CharacterData, arma: Arma): DannoExtra[] {
  const liv = c.info.livello;
  const extra: DannoExtra[] = [];
  const mischia = !arma.distanza;
  if (c.info.classe === "Ladro" && (arma.accurata || arma.distanza)) {
    extra.push({
      id: "attacco-furtivo", etichetta: "Attacco Furtivo", facoltativa: true,
      danni: { numero: dadiAttaccoFurtivo(liv), facce: 6, mod: 0, tipo: tipoDanni(arma.tipoDanno), etichetta: "Attacco Furtivo" },
      nota: "Una volta per turno, con vantaggio o con un alleato entro 1,5 m dal bersaglio.",
    });
  }
  if (eClasse(c, "Paladino", 2) && mischia && !eColpoSenzaArmi(arma) && slotUtilizzabili(c, 1).length > 0) {
    extra.push({
      id: "punizione-divina", etichetta: "Punizione Divina", facoltativa: true, slot: true, danni: dannoPunizione(slotUtilizzabili(c, 1)[0]),
      nota: "Spende uno slot incantesimo.",
    });
  }
  if (eClasse(c, "Paladino", 11) && mischia && !eColpoSenzaArmi(arma)) {
    extra.push({
      id: "punizione-migliorata", etichetta: "Punizione Divina Migliorata", facoltativa: false,
      danni: { numero: 1, facce: 8, mod: 0, tipo: "radiosi", etichetta: "Punizione Divina Migliorata" },
    });
  }
  return extra;
}

// Trucchetti: 1 dado, 2 dal 5° livello, 3 dall'11°, 4 dal 17°.
const moltiplicatoreTrucchetto = (livello: number) => (livello >= 17 ? 4 : livello >= 11 ? 3 : livello >= 5 ? 2 : 1);

export function dannoIncantesimo(s: IncantesimoDaLanciare, livelloSlot: number, livelloPersonaggio: number): Danni | null {
  if (!s.danni) return null;
  const base = parseDado(s.danni.dado);
  let numero = s.danni.trucchetto ? base.numero * moltiplicatoreTrucchetto(livelloPersonaggio) : base.numero;
  let mod = s.danni.mod ?? 0;
  const sopra = Math.max(0, livelloSlot - s.livello);
  if (s.danni.perLivello && s.livello > 0) numero += parseDado(s.danni.perLivello).numero * sopra;
  if (s.danni.modPerLivello && s.livello > 0) mod += s.danni.modPerLivello * sopra;
  return { numero, facce: base.facce, mod, tipo: s.danni.tipo };
}

export const numeroAttacchi = (s: IncantesimoDaLanciare, livelloSlot: number) =>
  s.attacco ? s.attacco.numero + (s.attacco.perLivello ?? 0) * Math.max(0, livelloSlot - s.livello) : 0;

// Livelli di slot con almeno uno slot libero, a partire dal livello dell'incantesimo.
export function slotUtilizzabili(c: CharacterData, livelloIncantesimo: number): number[] {
  const { slotMax } = derivate(c);
  return slotMax
    .map((max, i) => ({ livello: i + 1, liberi: max - Math.min(c.slotSpesi[i] ?? 0, max) }))
    .filter(x => x.livello >= livelloIncantesimo && x.liberi > 0)
    .map(x => x.livello);
}

// Spende uno slot di quel livello, se ce n'è uno libero (incantesimi, Punizione Divina...).
export function spendiSlot(c: CharacterData, livello: number): CharacterData {
  if (!slotUtilizzabili(c, livello).includes(livello)) return c;
  const slotSpesi = [...c.slotSpesi];
  slotSpesi[livello - 1] = (slotSpesi[livello - 1] ?? 0) + 1;
  return { ...c, slotSpesi };
}

// livelloSlot null = trucchetto o rituale: nessuno slot speso.
// Con `concentrazione` l'incantesimo sostituisce quello su cui ci si stava concentrando.
export function lanciaIncantesimo(
  c: CharacterData, livelloSlot: number | null, opzioni: { concentrazione?: string } = {},
): CharacterData {
  const speso = livelloSlot === null ? c : spendiSlot(c, livelloSlot);
  if (livelloSlot !== null && speso === c) return c;
  if (speso === c && !opzioni.concentrazione) return c;
  return { ...speso, concentrazione: opzioni.concentrazione ?? c.concentrazione };
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

// Con 4 livelli di indebolimento i PF massimi sono dimezzati.
export const pfMassimiEffettivi = (c: CharacterData) =>
  c.indebolimento >= 4 ? Math.floor(c.combattimento.pfMassimi / 2) : c.combattimento.pfMassimi;

export function applicaCura(c: CharacterData, cura: number): CharacterData {
  const cb = c.combattimento;
  if (cura <= 0 || statoVita(c) === "morto") return c;
  return {
    ...c,
    combattimento: {
      ...cb,
      pfAttuali: Math.min(pfMassimiEffettivi(c), cb.pfAttuali + cura),
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

// PF a ogni livello dal 2° in poi: media del Dado Vita (arrotondata per eccesso) + COS, almeno 1.
// Robustezza Nanica e Resilienza Draconica aggiungono 1 PF per livello.
export function pfPerLivello(c: CharacterData, dadoVita: number): number {
  const extra = (haPrivilegio(c, "Robustezza Nanica") ? 1 : 0) + (haPrivilegio(c, "Resilienza Draconica") ? 1 : 0);
  return Math.max(1, dadoVita / 2 + 1 + modificatore(c.caratteristiche.COS.valore)) + extra;
}

// PF al 1° livello: Dado Vita al massimo + COS (+ i bonus per livello di razza e origine).
export function pfPrimoLivello(c: CharacterData, dadoVita: number): number {
  const extra = (haPrivilegio(c, "Robustezza Nanica") ? 1 : 0) + (haPrivilegio(c, "Resilienza Draconica") ? 1 : 0);
  return Math.max(1, dadoVita + modificatore(c.caratteristiche.COS.valore)) + extra;
}

// CA: armatura indossata (con il limite di DES) o, senza armatura, la migliore tra 10 + DES,
// Difesa Senza Armatura della classe e Resilienza Draconica (13 + DES). Lo scudo dà +2
// (il Monaco perde la sua Difesa Senza Armatura se lo usa).
function classeArmatura(c: CharacterData, mod: (k: Caratteristica) => number) {
  const des = mod("DES");
  const scudo = c.scudo ? 2 : 0;
  const attivi = c.effetti.flatMap(e => effetto(e.id) ?? []);
  let base: { ca: number; nota: string };
  if (c.armatura) {
    const bonusDes = c.armatura.maxDes === null ? des : Math.min(des, c.armatura.maxDes);
    base = { ca: c.armatura.ca + bonusDes + scudo, nota: `${c.armatura.nome}${c.scudo ? " e scudo" : ""}` };
  } else {
    const opzioni = [{ ca: 10 + des + scudo, nota: c.scudo ? "Senza armatura, con scudo" : "Senza armatura" }];
    const difesa = regoleClasse(c.info.classe)?.difesaSenzaArmatura;
    if (difesa && !(difesa === "SAG" && c.scudo)) {
      opzioni.push({ ca: 10 + des + mod(difesa) + scudo, nota: "Difesa Senza Armatura" });
    }
    if (haPrivilegio(c, "Resilienza Draconica")) opzioni.push({ ca: 13 + des + scudo, nota: "Resilienza Draconica" });
    for (const e of attivi) if (e.caBase !== undefined) opzioni.push({ ca: e.caBase + des + scudo, nota: e.nome });
    base = opzioni.reduce((a, b) => (b.ca > a.ca ? b : a));
  }
  // Pelle Coriacea fissa un minimo prima dei bonus temporanei come Scudo.
  for (const e of attivi) {
    if (e.caMinima !== undefined && base.ca < e.caMinima) base = { ca: e.caMinima, nota: e.nome };
  }
  const bonus = attivi.filter(e => e.caBonus).map(e => ({ nome: e.nome, valore: e.caBonus ?? 0 }));
  // Stile di Combattimento Difesa: +1 con un'armatura indossata.
  if (c.armatura && haScelto(c, FONTE_STILE, STILI.difesa)) bonus.unshift({ nome: STILI.difesa, valore: 1 });
  return {
    ca: base.ca + bonus.reduce((acc, e) => acc + e.valore, 0),
    nota: [base.nota, ...bonus.map(e => `${e.nome} ${segno(e.valore)}`)].join(", "),
  };
}

export function derivate(c: CharacterData) {
  const liv = c.info.livello;
  const comp = bonusCompetenza(liv);
  const mod = (k: Caratteristica) => modificatore(c.caratteristiche[k].valore);
  const classe = regoleClasse(c.info.classe);
  const inc = incantatoreDi(c.info.classe, c.info.sottoclasse);
  // Chi non incanta per classe può avere trucchetti di razza (Alto Elfo, Tiefling...).
  const caratteristicaMagica: Caratteristica | null = inc?.caratteristica ?? CARATTERISTICA_MAGICA_RAZZIALE[c.info.razza] ?? null;
  const modMagia = caratteristicaMagica ? mod(caratteristicaMagica) : 0;
  const ts = (k: Caratteristica) => mod(k) + (c.caratteristiche[k].compTS ? comp : 0);
  const abilita = (id: string) => {
    const a = ABILITA.find(x => x.id === id);
    if (!a) return 0;
    return mod(a.car) + (c.competenzeAbilita.includes(id) ? comp : 0);
  };
  // Armi a distanza con la DES, accurate con la migliore tra FOR e DES, le altre con la FOR.
  // Mentre è in ira il bonus ai danni si aggiunge alle armi da mischia usate con la Forza.
  // Il bonus di un'arma magica vale per l'attacco e per i danni; quello di competenza solo con la competenza nell'arma.
  const iraAttiva = c.effetti.some(e => e.id === "ira");
  // Arti Marziali: il Monaco senza armatura né scudo usa con le armi da monaco la migliore tra FOR e DES
  // e il dado delle Arti Marziali se è più alto di quello dell'arma.
  const artiMarziali = c.info.classe === "Monaco" && !c.armatura && !c.scudo;
  const dadoMonaco = (dado: string) => {
    const { numero, facce } = parseDado(dado);
    const ma = dadoArtiMarziali(liv);
    return numero * (facce + 1) < ma + 1 ? `1d${ma}` : dado;
  };
  const stile = (nome: string) => haScelto(c, FONTE_STILE, nome);
  const attaccoArma = (arma: Arma & { bonus?: number }) => {
    const monaco = artiMarziali && armaDaMonaco(arma);
    const colpo = eColpoSenzaArmi(arma);
    const dueMani = /due mani/i.test(arma.proprieta);
    const usaDES = arma.distanza && !arma.accurata ? true : arma.accurata || monaco ? mod("DES") > mod("FOR") : false;
    const car: Caratteristica = usaDES ? "DES" : "FOR";
    const m = mod(car);
    const conForza = !arma.distanza && car === "FOR";
    const magico = arma.bonus ?? 0;
    const competente = colpo || competenteArma(c, arma);
    // Stili di combattimento: Tiro +2 a colpire a distanza, Duellare +2 ai danni in mischia a una mano.
    const tiro = arma.distanza && stile(STILI.tiro) ? 2 : 0;
    const duellare = !arma.distanza && !dueMani && !colpo && stile(STILI.duellare) ? 2 : 0;
    const note = [
      tiro > 0 && "Tiro: +2 al tiro per colpire.",
      !arma.distanza && (dueMani || arma.dadoVersatile) && stile(STILI.armiPossenti)
        && "Combattere con Armi Possenti: a due mani ritira i dadi di danno che fanno 1 o 2.",
    ].filter((x): x is string => typeof x === "string");
    // Senza Arti Marziali il colpo senz'armi fa 1 + FOR.
    const modDanno = m + magico + (iraAttiva && conForza ? bonusIra(liv) : 0) + (colpo && !monaco ? 1 : 0);
    const dadi = monaco
      ? { ...arma, dado: dadoMonaco(arma.dado), ...(arma.dadoVersatile ? { dadoVersatile: dadoMonaco(arma.dadoVersatile) } : {}) }
      : arma;
    return {
      bonus: m + (competente ? comp : 0) + magico + tiro, mod: m, car, competente, modDanno, mischiaFOR: conForza, note,
      danni: dannoArma(dadi, modDanno + duellare), // Duellare solo impugnandola in una mano
      danniDueMani: dadi.dadoVersatile ? dannoArma(dadi, modDanno, true) : null,
    };
  };
  const armaturaCompetente = competenteArmatura(c);
  const prossimaSoglia = liv < 20 ? SOGLIE_XP[liv] : null;
  const { ca, nota: notaCA } = classeArmatura(c, mod);
  const modoIncantesimi = inc?.modo ?? null;
  const prepara = modoIncantesimi === "preparati" || modoIncantesimi === "libro";
  const haPresagio = c.info.sottoclasse === "Scuola di Divinazione" && liv >= 2;
  // Incantesimi di dominio, giuramento e circolo: sempre preparati, fuori dal limite.
  const sottoclasse = incantesimiDiSottoclasse(c);
  const sempre = new Set(sottoclasse.sempre.map(nomeIncantesimo));

  return {
    comp,
    mod,
    ts,
    abilita,
    attaccoArma,
    attacchiPerAzione: attacchiPerAzione(c),
    sogliaCritico: sogliaCritico(c),
    dadiCriticoBrutale: dadiCriticoBrutale(c),
    artiMarziali,
    ca,
    notaCA,
    iniziativa: mod("DES"),
    percezionePassiva: 10 + abilita("percezione"),
    dadoVita: classe?.dadoVita ?? 8,
    caratteristicaMagica,
    incantatore: inc !== null,
    // Grimorio visibile a chi incanta per classe o ha incantesimi (per esempio trucchetti di razza).
    haIncantesimi: inc !== null || c.incantesimi.length > 0,
    modoIncantesimi,
    prepara, // chi prepara gli incantesimi ogni giorno (dall'intera lista o dal libro)
    cdMagia: caratteristicaMagica ? 8 + comp + modMagia : null,
    attaccoMagico: caratteristicaMagica ? comp + modMagia : null,
    maxPreparabili: prepara
      ? Math.max(1, (inc?.preparatiMetaLivello ? Math.floor(liv / 2) : liv) + modMagia)
      : null,
    preparatiAttuali: c.incantesimi.filter(s => s.livello > 0 && s.preparato && !sempre.has(nomeIncantesimo(s.nome))).length,
    incantesimiSempre: sottoclasse.sempre,
    incantesimiAmpliati: sottoclasse.ampliata, // lista ampliata del patrono del Warlock
    fonteIncantesimiSottoclasse: sottoclasse.fonte, // "Dominio", "Giuramento", "Circolo", "Patrono"
    semprePreparato: (nome: string) => sempre.has(nomeIncantesimo(nome)),
    maxConosciuti: inc?.modo === "conosciuti" ? (inc.conosciuti?.[liv - 1] ?? 0) : null,
    conosciutiAttuali: c.incantesimi.filter(s => s.livello > 0).length,
    maxTrucchetti: inc?.trucchetti[liv - 1] ?? 0,
    trucchettiAttuali: c.incantesimi.filter(s => s.livello === 0).length,
    slotMax: slotMassimi(inc, liv),
    pattoMagico: inc?.tipo === "patto",
    // L'armatura e lo scudo indossati pesano anche se non sono nello zaino.
    pesoTotale: c.inventario.reduce((acc, it) => acc + it.peso * it.qta, 0) + (c.armatura?.peso ?? 0) + (c.scudo ? PESO_SCUDO : 0),
    avvisiArmatura: [
      c.armatura?.svantaggioFurtivita && "Svantaggio alle prove di Destrezza (Furtività).",
      c.armatura && c.armatura.forzaMin > c.caratteristiche.FOR.valore && `Forza inferiore a ${c.armatura.forzaMin}: velocità ridotta di 3 m.`,
      !armaturaCompetente && "Armatura o scudo senza competenza: svantaggio a prove, TS e attacchi di FOR e DES, niente incantesimi.",
    ].filter((x): x is string => typeof x === "string"),
    armaturaCompetente,
    // Motivo per cui ora non si possono lanciare incantesimi (null = si può).
    incantesimiBloccati: armaturaCompetente ? null : "Indossi un'armatura o uno scudo senza averne la competenza.",
    capacitaCarico: c.caratteristiche.FOR.valore * 15,
    prossimaSoglia,
    puoSalire: prossimaSoglia !== null && c.xp.totale >= prossimaSoglia,
    haPresagio,
    // Dadi del Presagio non ancora usati: si possono scegliere nel dialogo di un tiro per colpire, TS o prova.
    presagioDisponibile: haPresagio
      ? c.divinazione.presagio.flatMap((valore, indice) => (c.divinazione.usati[indice] ? [] : [{ indice, valore }]))
      : [],
    dadiPresagio: liv >= 14 ? 3 : 2, // Presagio Superiore al 14°
    haRecuperoArcano: c.info.classe === "Mago",
    budgetRecuperoArcano: Math.ceil(liv / 2),
    dadiVitaRecuperati: Math.max(1, Math.floor(liv / 2)),
    risorse: risorseDelPersonaggio(c.info, mod, c.risorseUsate),
    pfMassimiEffettivi: pfMassimiEffettivi(c),
  };
}

export type Derivate = ReturnType<typeof derivate>;

// `presagio`: i nuovi d20 del Presagio, solo per chi ce l'ha (Scuola di Divinazione).
// Il riposo lungo toglie anche un livello di indebolimento e fa terminare tutti gli effetti attivi.
export function riposoLungo(c: CharacterData, presagio?: number[]): CharacterData {
  const d = derivate(c);
  const riposato = { ...c, indebolimento: Math.max(0, c.indebolimento - 1) };
  return {
    ...c,
    indebolimento: riposato.indebolimento,
    effetti: [],
    risorseUsate: {},
    combattimento: {
      ...c.combattimento,
      pfAttuali: pfMassimiEffettivi(riposato),
      dadiVitaRimanenti: Math.min(c.info.livello, c.combattimento.dadiVitaRimanenti + d.dadiVitaRecuperati),
      tsMorte: TS_MORTE_AZZERATI,
      stabile: false,
    },
    slotSpesi: c.slotSpesi.map(() => 0),
    divinazione: presagio ? { presagio, usati: presagio.map(() => false) } : c.divinazione,
    recuperoArcanoUsato: false,
    concentrazione: null,
  };
}

// Il riposo breve recupera tutti gli slot della magia del patto (Warlock).
export function riposoBreve(c: CharacterData, esito: EsitoRiposoBreve): CharacterData {
  const usaRecupero = esito.slotRecuperati.some(n => n > 0);
  const patto = incantatoreDi(c.info.classe, c.info.sottoclasse)?.tipo === "patto";
  const curato = applicaCura(c, esito.pfRecuperati);
  // Si ricaricano le risorse "breve" e scadono gli effetti di breve durata.
  const risorseUsate = { ...c.risorseUsate };
  for (const r of derivate(c).risorse) if (r.ricarica === "breve") delete risorseUsate[r.id];
  return {
    ...curato,
    risorseUsate,
    effetti: c.effetti.filter(e => effetto(e.id)?.finisce === "lunga"),
    combattimento: {
      ...curato.combattimento,
      dadiVitaRimanenti: Math.max(0, c.combattimento.dadiVitaRimanenti - esito.dadiVitaSpesi),
    },
    slotSpesi: patto ? c.slotSpesi.map(() => 0) : c.slotSpesi.map((s, i) => Math.max(0, s - (esito.slotRecuperati[i] ?? 0))),
    recuperoArcanoUsato: c.recuperoArcanoUsato || usaRecupero,
    concentrazione: null, // semplificazione: dopo almeno 1 ora di riposo la concentrazione si considera finita
  };
}

// Nomi degli incantesimi confrontati senza maiuscole né spazi ai lati.
const nomeIncantesimo = (nome: string) => nome.trim().toLowerCase();

// Incantesimi di sottoclasse (dominio, giuramento, circolo) che la scheda non ha ancora nel grimorio.
export function incantesimiSottoclasseMancanti(c: CharacterData): string[] {
  const presenti = new Set(c.incantesimi.map(s => nomeIncantesimo(s.nome)));
  return incantesimiDiSottoclasse(c).sempre.filter(n => !presenti.has(nomeIncantesimo(n)));
}

// Aggiunge al grimorio gli incantesimi che non ci sono già (per nome), con il loro stato di preparazione.
export function aggiungiIncantesimi(c: CharacterData, nuovi: Spell[]): CharacterData {
  const presenti = new Set(c.incantesimi.map(s => nomeIncantesimo(s.nome)));
  const daAggiungere = nuovi.filter(s => {
    const n = nomeIncantesimo(s.nome);
    if (presenti.has(n)) return false;
    presenti.add(n);
    return true;
  });
  if (daAggiungere.length === 0) return c;
  return { ...c, incantesimi: [...c.incantesimi, ...daAggiungere] };
}

// Aumento dei punteggi di caratteristica: +2 a una o +1 a due, senza superare 20. Passa da modificaCaratteristica,
// quindi un aumento della COS alza i PF massimi di tutti i livelli. Un aumento non valido non cambia la scheda.
export function applicaAumento(c: CharacterData, aumenti: Partial<Record<Caratteristica, number>>): CharacterData {
  const voci = Object.entries(aumenti).filter(([, n]) => n) as [Caratteristica, number][];
  const totale = voci.reduce((acc, [, n]) => acc + n, 0);
  if (totale !== 2 || voci.some(([k, n]) => (n !== 1 && n !== 2) || c.caratteristiche[k].valore + n > 20)) return c;
  return voci.reduce((acc, [k, n]) => modificaCaratteristica(acc, k, n), c);
}

// Incantesimi del catalogo che si possono imparare salendo al livello indicato: della lista della classe
// (o del Mago per i terzi incantatori) più la lista ampliata del patrono, fino al livello di slot più alto
// disponibile, esclusi quelli già nel grimorio.
export function incantesimiDaImparare(
  c: CharacterData, catalogo: IncantesimoCatalogo[], livello: number, sottoclasse = c.info.sottoclasse,
): { trucchetti: IncantesimoCatalogo[]; incantesimi: IncantesimoCatalogo[] } {
  const inc = incantatoreDi(c.info.classe, sottoclasse);
  const lista = classeDellaLista(c.info.classe, sottoclasse);
  const ampliata = new Set(incantesimiDiSottoclasse({ ...c, info: { ...c.info, livello, sottoclasse } }).ampliata.map(nomeIncantesimo));
  const presenti = new Set(c.incantesimi.map(s => nomeIncantesimo(s.nome)));
  const massimo = livelloMassimoIncantesimi(inc, livello);
  const disponibili = catalogo.filter(i => !presenti.has(nomeIncantesimo(i.nome))
    && (i.classi.includes(lista) || ampliata.has(nomeIncantesimo(i.nome))));
  return {
    trucchetti: inc ? disponibili.filter(i => i.livello === 0) : [],
    incantesimi: disponibili.filter(i => i.livello > 0 && i.livello <= massimo),
  };
}

// Filtri della ricerca di incantesimi nel catalogo; un filtro assente o vuoto non esclude nulla.
export interface FiltriIncantesimi {
  testo?: string;
  livello?: number | null;
  scuola?: string | null;
  classe?: string | null;
  concentrazione?: boolean;
  rituale?: boolean;
}

export interface GruppoIncantesimi<T> {
  livello: number;
  scuole: { scuola: string; voci: T[] }[];
}

// Senza maiuscole né accenti ("invocazione" trova "Invocazione", "scudo" trova "Scudo della Fede").
const senzaAccenti = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

// Filtra gli incantesimi del catalogo e li divide per livello e, dentro ogni livello, per scuola
// (nell'ordine di SCUOLE, poi eventuali scuole sconosciute), tutto in ordine alfabetico.
export function raggruppaIncantesimi<T extends { nome: string; livello: number; scuola: string; scheda?: DettagliIncantesimo; classi?: string[] }>(
  voci: T[], filtri: FiltriIncantesimi = {},
): GruppoIncantesimi<T>[] {
  const testo = senzaAccenti(filtri.testo ?? "");
  const scelte = voci
    .filter(v => (testo === "" || senzaAccenti(v.nome).includes(testo))
      && (filtri.livello == null || v.livello === filtri.livello)
      && (!filtri.scuola || v.scuola === filtri.scuola)
      && (!filtri.classe || (v.classi ?? []).includes(filtri.classe))
      && (!filtri.concentrazione || v.scheda?.concentrazione)
      && (!filtri.rituale || v.scheda?.rituale))
    .sort((a, b) => a.nome.localeCompare(b.nome, "it"));
  const ordineScuola = (s: string) => (SCUOLE.includes(s) ? SCUOLE.indexOf(s) : SCUOLE.length);
  const gruppi: GruppoIncantesimi<T>[] = [];
  for (const livello of [...new Set(scelte.map(v => v.livello))].sort((a, b) => a - b)) {
    const delLivello = scelte.filter(v => v.livello === livello);
    const scuole = [...new Set(delLivello.map(v => v.scuola))]
      .sort((a, b) => ordineScuola(a) - ordineScuola(b) || a.localeCompare(b, "it"));
    gruppi.push({ livello, scuole: scuole.map(scuola => ({ scuola, voci: delLivello.filter(v => v.scuola === scuola) })) });
  }
  return gruppi;
}

// Aggiunge PF medi, un Dado Vita e i privilegi del nuovo livello (letti dal catalogo prima di salire),
// ed eventualmente la sottoclasse scelta a quel livello, gli incantesimi nuovi (di sottoclasse o scelti),
// l'aumento dei punteggi di caratteristica o un talento (privilegio con fonte "Talento").
export function saliDiLivello(
  c: CharacterData,
  extra: {
    privilegi?: CharacterData["privilegi"]; sottoclasse?: string; incantesimi?: Spell[];
    aumenti?: Partial<Record<Caratteristica, number>>; talento?: Privilegio;
  } = {},
): CharacterData {
  const pf = pfPerLivello(c, regoleClasse(c.info.classe)?.dadoVita ?? 8);
  const nuovi: CharacterData["privilegi"] = [];
  for (const p of [...(extra.privilegi ?? []), ...(extra.talento ? [extra.talento] : [])]) {
    if (![...c.privilegi, ...nuovi].some(x => x.nome === p.nome && x.fonte === p.fonte)) nuovi.push(p);
  }
  const salito = aggiungiIncantesimi({
    ...c,
    info: { ...c.info, livello: c.info.livello + 1, sottoclasse: extra.sottoclasse ?? c.info.sottoclasse },
    privilegi: [...c.privilegi, ...nuovi],
    combattimento: {
      ...c.combattimento,
      pfMassimi: c.combattimento.pfMassimi + pf,
      pfAttuali: c.combattimento.pfAttuali + pf,
      dadiVitaRimanenti: c.combattimento.dadiVitaRimanenti + 1,
    },
  }, extra.incantesimi ?? []);
  // I PF del nuovo livello usano la COS di prima: l'aumento della COS poi li corregge per tutti i livelli.
  return extra.aumenti ? applicaAumento(salito, extra.aumenti) : salito;
}

// Livelli con l'aumento dei punteggi di caratteristica (o un talento): 4, 8, 12, 16, 19, più quelli della classe.
export const haAumentoCaratteristiche = (classe: string, livello: number) =>
  LIVELLI_AUMENTO_CARATTERISTICHE.includes(livello) || (regoleClasse(classe)?.aumentiExtra ?? []).includes(livello);

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

// --- Risorse di classe (Ira, Ki, Incanalare Divinità...) ---

// `quantita` positiva spende usi, negativa li recupera; il risultato resta tra 0 e il massimo.
// Le risorse illimitate o inesistenti non cambiano.
export function usaRisorsa(c: CharacterData, id: string, quantita = 1): CharacterData {
  const r = derivate(c).risorse.find(x => x.id === id);
  if (!r || r.max === null) return c;
  const usati = Math.max(0, Math.min(r.max, r.usati + quantita));
  if (usati === r.usati) return c;
  const risorseUsate = { ...c.risorseUsate, [id]: usati };
  if (usati === 0) delete risorseUsate[id];
  return { ...c, risorseUsate };
}

// --- Effetti attivi ---

// Un privilegio di classe si attiva solo con la classe e il livello giusti e, se consuma una risorsa, con un uso libero.
function privilegioDisponibile(c: CharacterData, def: DefinizioneEffetto) {
  if (def.classe !== c.info.classe || c.info.livello < (def.livelloMinimo ?? 1)) return false;
  if (!def.consuma) return true;
  const r = derivate(c).risorse.find(x => x.id === def.consuma);
  return !!r && (r.rimasti === null || r.rimasti > 0);
}

// Effetti che si possono segnare dal pannello: i privilegi del personaggio e gli incantesimi che un alleato
// può lanciare su di lui. Gli incantesimi solo personali (Scudo, Immagine Speculare) partono solo dal lancio.
export function effettiAttivabili(c: CharacterData): { privilegi: DefinizioneEffetto[]; daAlleato: DefinizioneEffetto[] } {
  const liberi = EFFETTI.filter(e => !c.effetti.some(x => x.id === e.id));
  return {
    privilegi: liberi.filter(e => e.classe && privilegioDisponibile(c, e)),
    daAlleato: liberi.filter(e => !e.classe && e.bersaglio === "altri"),
  };
}

// Attivare un effetto che consuma una risorsa (l'Ira) richiede un uso disponibile.
// Senza `daIncantesimo` valgono i limiti del pannello (effettiAttivabili).
export function attivaEffetto(c: CharacterData, id: string, opzioni: { daIncantesimo?: boolean } = {}): CharacterData {
  const def = effetto(id);
  if (!def || c.effetti.some(e => e.id === id)) return c;
  if (def.classe && !privilegioDisponibile(c, def)) return c;
  if (!def.classe && !opzioni.daIncantesimo && def.bersaglio !== "altri") return c;
  const prossimo = def.consuma ? usaRisorsa(c, def.consuma) : c;
  return {
    ...prossimo,
    concentrazione: def.finisceConcentrazione ? null : prossimo.concentrazione,
    effetti: [...prossimo.effetti, def.conteggio === undefined ? { id } : { id, valore: def.conteggio }],
  };
}

export const rimuoviEffetto = (c: CharacterData, id: string): CharacterData =>
  c.effetti.some(e => e.id === id) ? { ...c, effetti: c.effetti.filter(e => e.id !== id) } : c;

// Cambia il contatore di un effetto (i duplicati di Immagine Speculare): a 0 l'effetto termina.
export function cambiaConteggioEffetto(c: CharacterData, id: string, delta: number): CharacterData {
  const attuale = c.effetti.find(e => e.id === id);
  const massimo = effetto(id)?.conteggio;
  if (!attuale || massimo === undefined) return c;
  const valore = Math.min(massimo, (attuale.valore ?? massimo) + delta);
  if (valore <= 0) return rimuoviEffetto(c, id);
  return { ...c, effetti: c.effetti.map(e => (e.id === id ? { ...e, valore } : e)) };
}

// --- Condizioni e indebolimento ---

// Le condizioni che rendono incapaci di agire interrompono la concentrazione.
export function aggiungiCondizione(c: CharacterData, id: string): CharacterData {
  const def = condizione(id);
  if (!def || c.condizioni.includes(id)) return c;
  return {
    ...c,
    condizioni: [...c.condizioni, id],
    concentrazione: def.finisceConcentrazione ? null : c.concentrazione,
  };
}

export const rimuoviCondizione = (c: CharacterData, id: string): CharacterData =>
  c.condizioni.includes(id) ? { ...c, condizioni: c.condizioni.filter(x => x !== id) } : c;

// A 4 livelli i PF massimi si dimezzano: i PF attuali non possono superarli.
export function impostaIndebolimento(c: CharacterData, livello: number): CharacterData {
  const nuovo = Math.max(0, Math.min(6, Math.trunc(livello)));
  const prossimo = { ...c, indebolimento: nuovo };
  return {
    ...prossimo,
    combattimento: {
      ...c.combattimento,
      pfAttuali: Math.min(c.combattimento.pfAttuali, pfMassimiEffettivi(prossimo)),
    },
  };
}

// --- Privilegi di classe ---

// Privilegi di classe (e della sottoclasse scelta) fino al livello attuale che la scheda non ha ancora:
// servono a chi aveva già salito di livello quando il catalogo conteneva solo il 1° livello.
export function privilegiMancanti(c: CharacterData, catalogo: PrivilegioClasse[]): Privilegio[] {
  const chiave = (p: Privilegio) => `${p.nome}|${p.fonte}`.toLowerCase();
  const posseduti = new Set(c.privilegi.map(chiave));
  return catalogo
    .filter(x => x.classe === c.info.classe && x.livello <= c.info.livello
      && (x.sottoclasse === null || x.sottoclasse === c.info.sottoclasse))
    .sort((a, b) => a.livello - b.livello)
    .map(x => x.privilegio)
    .filter(p => !posseduti.has(chiave(p)));
}

// --- Scelte di privilegio (Metamagia, Stile di Combattimento, terreno del circolo) ---

// Le scelte che mancano alla scheda: per ogni scelta quante opzioni sono dovute a quel livello e quante ne ha.
// `info` permette di guardare al livello successivo (con la sottoclasse scelta salendo).
export function sceltePendenti(
  c: CharacterData, info: { livello?: number; sottoclasse?: string } = {},
): { scelta: DefinizioneScelta; mancano: number }[] {
  const livello = info.livello ?? c.info.livello;
  const sottoclasse = info.sottoclasse ?? c.info.sottoclasse;
  return scelteDelPersonaggio({ info: { ...c.info, livello, sottoclasse } }).flatMap(scelta => {
    const scelte = c.privilegi.filter(p => p.fonte === scelta.fonte && (!scelta.ammesse || scelta.ammesse.includes(p.nome))).length;
    const mancano = totaleScelte(scelta, livello) - scelte;
    return mancano > 0 ? [{ scelta, mancano }] : [];
  });
}

// --- Stregone: Metamagia e Fonte di Magia ---

const PUNTI_STREGONERIA = "punti-stregoneria";
const puntiStregoneria = (c: CharacterData) => derivate(c).risorse.find(r => r.id === PUNTI_STREGONERIA);

// Costo complessivo delle metamagie scelte per un incantesimo di quel livello (0 = trucchetto).
export const costoMetamagia = (nomi: string[], livelloIncantesimo: number) =>
  nomi.reduce((acc, n) => acc + (metamagia(n)?.costo(livelloIncantesimo) ?? 0), 0);

// Spende i punti delle metamagie; senza punti a sufficienza la scheda non cambia.
export function usaMetamagia(c: CharacterData, nomi: string[], livelloIncantesimo: number): CharacterData {
  const costo = costoMetamagia(nomi, livelloIncantesimo);
  const r = puntiStregoneria(c);
  if (costo === 0 || !r || (r.rimasti ?? 0) < costo) return c;
  return usaRisorsa(c, PUNTI_STREGONERIA, costo);
}

// Fonte di Magia: uno slot libero diventa punti stregoneria pari al suo livello.
// Semplificazione: si converte solo se i punti spesi bastano a riceverli tutti (non si supera il massimo).
export function slotInPunti(c: CharacterData, livello: number): CharacterData {
  const r = puntiStregoneria(c);
  if (!r || r.usati < livello || !slotUtilizzabili(c, livello).includes(livello)) return c;
  return usaRisorsa(spendiSlot(c, livello), PUNTI_STREGONERIA, -livello);
}

// Fonte di Magia: con 2/3/5/6/7 punti si crea uno slot dal 1° al 5° livello.
// Semplificazione: lo slot creato ne recupera uno speso, quindi non si superano gli slot massimi.
export function puntiInSlot(c: CharacterData, livello: number): CharacterData {
  const costo = COSTO_SLOT_STREGONERIA[livello - 1];
  const r = puntiStregoneria(c);
  if (costo === undefined || !r || (r.rimasti ?? 0) < costo || (c.slotSpesi[livello - 1] ?? 0) <= 0) return c;
  const slotSpesi = c.slotSpesi.map((n, i) => (i === livello - 1 ? n - 1 : n));
  return usaRisorsa({ ...c, slotSpesi }, PUNTI_STREGONERIA, costo);
}

// --- Presagio (Scuola di Divinazione) ---

// Segna come usato un dado del Presagio che ha sostituito un tiro.
export function usaPresagio(c: CharacterData, indice: number): CharacterData {
  const { presagio, usati } = c.divinazione;
  if (indice < 0 || indice >= presagio.length || usati[indice]) return c;
  return { ...c, divinazione: { presagio, usati: presagio.map((_, i) => (i === indice ? true : usati[i] === true)) } };
}

// --- Armi del personaggio ---

// Nuova copia di un'arma del catalogo: senza bonus, senza contatori, intatta.
export const nuovaArma = (arma: Arma, id: number): ArmaPersonaggio =>
  ({ ...arma, id, bonus: 0, munizioni: null, durabilita: null, danneggiata: null, rotta: false });

// Armi che sparano munizioni (archi, balestre, fionde): all'inizio se ne hanno 20.
export const MUNIZIONI_INIZIALI = 20;
export const usaMunizioni = (a: Arma) => /munizioni/i.test(a.proprieta);

// Un'arma rotta o senza munizioni non si può usare per attaccare.
export function statoArma(a: ArmaPersonaggio): { utilizzabile: boolean; motivo: string | null } {
  if (a.rotta) return { utilizzabile: false, motivo: "Arma rotta: riparala per usarla." };
  if (a.munizioni && a.munizioni.rimasti <= 0) return { utilizzabile: false, motivo: "Munizioni esaurite." };
  return { utilizzabile: true, motivo: null };
}

const modificaArma = (c: CharacterData, id: number, f: (a: ArmaPersonaggio) => ArmaPersonaggio): CharacterData => {
  const indice = c.armi.findIndex(a => a.id === id);
  if (indice < 0) return c;
  const nuova = f(c.armi[indice]);
  return nuova === c.armi[indice] ? c : { ...c, armi: c.armi.map((a, i) => (i === indice ? nuova : a)) };
};

// Dopo un tiro per colpire: una munizione e un punto di durabilità (o un colpo, se è danneggiata) in meno.
// Quando la durabilità o i colpi arrivano a 0 l'arma si rompe.
export const usaArma = (c: CharacterData, id: number): CharacterData =>
  modificaArma(c, id, a => {
    if (!statoArma(a).utilizzabile) return a;
    const munizioni = a.munizioni && { ...a.munizioni, rimasti: a.munizioni.rimasti - 1 };
    const durabilita = a.durabilita && { ...a.durabilita, rimasti: Math.max(0, a.durabilita.rimasti - 1) };
    const danneggiata = a.danneggiata === null ? null : Math.max(0, a.danneggiata - 1);
    if (!munizioni && !durabilita && danneggiata === null) return a;
    return { ...a, munizioni, durabilita, danneggiata, rotta: durabilita?.rimasti === 0 || danneggiata === 0 };
  });

// Danneggiare un'arma le lascia `colpi` attacchi prima di rompersi: con la durabilità ne abbassa i punti rimasti
// (senza mai alzarli), senza durabilità la segna come danneggiata. Con 0 colpi si rompe subito.
export function danneggiaArma(c: CharacterData, id: number, colpi: number): CharacterData {
  const n = Math.trunc(colpi);
  if (!Number.isFinite(n) || n <= 0) return rompiArma(c, id);
  return modificaArma(c, id, a => {
    if (a.rotta) return a;
    if (a.durabilita) {
      const rimasti = Math.min(a.durabilita.rimasti, n);
      return rimasti === a.durabilita.rimasti ? a : { ...a, durabilita: { ...a.durabilita, rimasti } };
    }
    const danneggiata = Math.min(a.danneggiata ?? n, n);
    return danneggiata === a.danneggiata ? a : { ...a, danneggiata };
  });
}

// Riparare un'arma la rimette in uso intatta: durabilità al massimo e nessun danno.
export const riparaArma = (c: CharacterData, id: number): CharacterData =>
  modificaArma(c, id, a => ({
    ...a, rotta: false, danneggiata: null, durabilita: a.durabilita && { ...a.durabilita, rimasti: a.durabilita.massimo },
  }));

export const rompiArma = (c: CharacterData, id: number): CharacterData =>
  modificaArma(c, id, a => (a.rotta ? a : { ...a, rotta: true }));

// Aggiunge (o toglie, con `quantita` negativa) munizioni, tra 0 e il massimo.
export const ricaricaArma = (c: CharacterData, id: number, quantita: number): CharacterData =>
  modificaArma(c, id, a => {
    if (!a.munizioni) return a;
    const rimasti = Math.max(0, Math.min(a.munizioni.massimo, a.munizioni.rimasti + quantita));
    return rimasti === a.munizioni.rimasti ? a : { ...a, munizioni: { ...a.munizioni, rimasti } };
  });

// Dopo uno scontro si recupera metà delle munizioni spese (per difetto).
export const recuperaMunizioni = (c: CharacterData, id: number): CharacterData => {
  const a = c.armi.find(x => x.id === id);
  return a?.munizioni ? ricaricaArma(c, id, Math.floor((a.munizioni.massimo - a.munizioni.rimasti) / 2)) : c;
};
