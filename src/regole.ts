// Regole D&D 5e (edizione 2014). Le regole delle singole classi stanno in dati/classi.ts.
import type { Arma, ArmaPersonaggio, Caratteristica, CharacterData, DettagliIncantesimo, EsitoRiposoBreve, Privilegio, PrivilegioClasse } from "./tipi.ts";
import { CARATTERISTICA_MAGICA_RAZZIALE, incantatoreDi, regoleClasse, type Incantatore } from "./dati/classi.ts";
import { bonusIra, risorseDelPersonaggio } from "./dati/risorse.ts";
import { EFFETTI, condizione, effetto, type DefinizioneEffetto } from "./dati/condizioni.ts";
import { competenteArma, competenteArmatura } from "./dati/competenze.ts";

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
  const bonus = attivi.filter(e => e.caBonus);
  return {
    ca: base.ca + bonus.reduce((acc, e) => acc + (e.caBonus ?? 0), 0),
    nota: [base.nota, ...bonus.map(e => `${e.nome} ${segno(e.caBonus ?? 0)}`)].join(", "),
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
  const attaccoArma = (arma: Arma & { bonus?: number }) => {
    const usaDES = arma.distanza && !arma.accurata ? true : arma.accurata ? mod("DES") > mod("FOR") : false;
    const car: Caratteristica = usaDES ? "DES" : "FOR";
    const m = mod(car);
    const conForza = !arma.distanza && car === "FOR";
    const magico = arma.bonus ?? 0;
    const competente = competenteArma(c, arma);
    return {
      bonus: m + (competente ? comp : 0) + magico, mod: m, car, competente,
      modDanno: m + magico + (iraAttiva && conForza ? bonusIra(liv) : 0), mischiaFOR: conForza,
    };
  };
  const armaturaCompetente = competenteArmatura(c);
  const prossimaSoglia = liv < 20 ? SOGLIE_XP[liv] : null;
  const { ca, nota: notaCA } = classeArmatura(c, mod);
  const modoIncantesimi = inc?.modo ?? null;
  const prepara = modoIncantesimi === "preparati" || modoIncantesimi === "libro";
  const haPresagio = c.info.sottoclasse === "Scuola di Divinazione" && liv >= 2;

  return {
    comp,
    mod,
    ts,
    abilita,
    attaccoArma,
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
    preparatiAttuali: c.incantesimi.filter(s => s.livello > 0 && s.preparato).length,
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

// Aggiunge PF medi, un Dado Vita e i privilegi del nuovo livello (letti dal catalogo prima di salire),
// ed eventualmente la sottoclasse scelta a quel livello.
export function saliDiLivello(
  c: CharacterData, extra: { privilegi?: CharacterData["privilegi"]; sottoclasse?: string } = {},
): CharacterData {
  const pf = pfPerLivello(c, regoleClasse(c.info.classe)?.dadoVita ?? 8);
  const nuovi: CharacterData["privilegi"] = [];
  for (const p of extra.privilegi ?? []) {
    if (![...c.privilegi, ...nuovi].some(x => x.nome === p.nome && x.fonte === p.fonte)) nuovi.push(p);
  }
  return {
    ...c,
    info: { ...c.info, livello: c.info.livello + 1, sottoclasse: extra.sottoclasse ?? c.info.sottoclasse },
    privilegi: [...c.privilegi, ...nuovi],
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
