import type { Caratteristica, CharacterData } from "../tipi.ts";
import type { Modalita } from "../regole.ts";

// Condizioni (appendice A del Manuale del Giocatore, 5e 2014), indebolimento ed effetti attivi
// (incantesimi e privilegi con una durata). Nella scheda si salvano solo gli id: qui c'è tutto il resto.

// --- Condizioni ---

type Effetto = "svantaggio" | "vantaggio";

export interface DefinizioneCondizione {
  id: string;
  nome: string;
  descrizione: string;
  attacchi?: Effetto; // sui propri tiri per colpire
  prove?: "svantaggio"; // sulle proprie prove di caratteristica
  ts?: Partial<Record<Caratteristica, "svantaggio" | "fallimento">>;
  finisceConcentrazione?: boolean; // l'incapacità interrompe la concentrazione
}

const FALLISCE_FOR_DES = { FOR: "fallimento", DES: "fallimento" } as const;

export const CONDIZIONI: DefinizioneCondizione[] = [
  { id: "accecato", nome: "Accecato", attacchi: "svantaggio",
    descrizione: "Non vede: fallisce le prove che richiedono la vista. Svantaggio ai suoi attacchi; gli attacchi contro di lui hanno vantaggio." },
  { id: "affascinato", nome: "Affascinato",
    descrizione: "Non può attaccare chi lo ha affascinato né bersagliarlo con effetti dannosi. Chi lo ha affascinato ha vantaggio alle prove sociali contro di lui." },
  { id: "afferrato", nome: "Afferrato",
    descrizione: "La sua velocità è 0. Termina se chi lo afferra è incapacitato o se viene allontanato dalla sua portata." },
  { id: "assordato", nome: "Assordato",
    descrizione: "Non sente: fallisce le prove che richiedono l'udito." },
  { id: "avvelenato", nome: "Avvelenato", attacchi: "svantaggio", prove: "svantaggio",
    descrizione: "Svantaggio ai tiri per colpire e alle prove di caratteristica." },
  { id: "incapacitato", nome: "Incapacitato", finisceConcentrazione: true,
    descrizione: "Non può effettuare azioni né reazioni." },
  { id: "invisibile", nome: "Invisibile", attacchi: "vantaggio",
    descrizione: "Non si vede senza magia o sensi speciali. Vantaggio ai suoi attacchi; gli attacchi contro di lui hanno svantaggio." },
  { id: "paralizzato", nome: "Paralizzato", ts: FALLISCE_FOR_DES, finisceConcentrazione: true,
    descrizione: "Incapacitato, non si muove né parla. Fallisce i TS di Forza e Destrezza. Gli attacchi contro di lui hanno vantaggio e, da vicino, sono critici." },
  { id: "pietrificato", nome: "Pietrificato", ts: FALLISCE_FOR_DES, finisceConcentrazione: true,
    descrizione: "Trasformato in sostanza solida: incapacitato, inconsapevole, resistente a ogni danno, immune a veleni e malattie. Fallisce i TS di Forza e Destrezza; attacchi contro di lui con vantaggio." },
  { id: "prono", nome: "Prono", attacchi: "svantaggio",
    descrizione: "Può solo strisciare, o rialzarsi spendendo metà del movimento. Svantaggio ai suoi attacchi; gli attacchi contro di lui hanno vantaggio da vicino e svantaggio da lontano." },
  { id: "privo-di-sensi", nome: "Privo di Sensi", ts: FALLISCE_FOR_DES, finisceConcentrazione: true,
    descrizione: "Incapacitato, prono, lascia cadere ciò che tiene e non si accorge di nulla. Fallisce i TS di Forza e Destrezza. Gli attacchi contro di lui hanno vantaggio e, da vicino, sono critici." },
  { id: "spaventato", nome: "Spaventato", attacchi: "svantaggio", prove: "svantaggio",
    descrizione: "Svantaggio a prove e attacchi finché la fonte della paura è in vista; non può avvicinarsi volontariamente ad essa." },
  { id: "stordito", nome: "Stordito", ts: FALLISCE_FOR_DES, finisceConcentrazione: true,
    descrizione: "Incapacitato, non si muove e parla a fatica. Fallisce i TS di Forza e Destrezza. Gli attacchi contro di lui hanno vantaggio." },
  { id: "trattenuto", nome: "Trattenuto", attacchi: "svantaggio", ts: { DES: "svantaggio" },
    descrizione: "La sua velocità è 0. Svantaggio ai suoi attacchi e ai TS di Destrezza; gli attacchi contro di lui hanno vantaggio." },
];

export const condizione = (id: string) => CONDIZIONI.find(c => c.id === id);

// Indebolimento: livelli da 1 a 6, ciascuno con gli effetti dei precedenti.
export const LIVELLI_INDEBOLIMENTO = [
  "Svantaggio alle prove di caratteristica",
  "Velocità dimezzata",
  "Svantaggio ai tiri per colpire e ai tiri salvezza",
  "PF massimi dimezzati",
  "Velocità ridotta a 0",
  "Morte",
];

// --- Effetti attivi ---

export type TipoTiro = "attacco" | "prova" | "ts";

export interface DefinizioneEffetto {
  id: string;
  nome: string;
  descrizione: string;
  durata: string;
  // Dopo quale riposo scompare: "breve" (e "lunga") per gli effetti brevi, "lunga" per quelli di un'intera giornata.
  finisce: "breve" | "lunga";
  incantesimo?: string; // il lancio di questo incantesimo lo attiva
  classe?: string; // privilegio di questa classe: solo lei può attivarlo
  caBonus?: number;
  caBase?: number; // senza armatura la CA è questo valore + DES (Armatura Magica)
  caMinima?: number; // la CA non scende sotto questo valore (Pelle Coriacea)
  conteggio?: number; // valore iniziale di un contatore (duplicati di Immagine Speculare)
  consuma?: string; // id della risorsa che si spende attivandolo (Ira)
  finisceConcentrazione?: boolean;
  vantaggio?: { prove?: Caratteristica[]; ts?: Caratteristica[]; attacchiMischiaFOR?: boolean };
  notaTiro?: Partial<Record<TipoTiro, string>>;
}

export const EFFETTI: DefinizioneEffetto[] = [
  { id: "ira", nome: "Ira", durata: "1 minuto", finisce: "breve", classe: "Barbaro", consuma: "ira", finisceConcentrazione: true,
    descrizione: "Vantaggio alle prove e ai TS di Forza, bonus ai danni in mischia con la Forza, resistenza ai danni contundenti, perforanti e taglienti. Non si possono lanciare incantesimi. Finisce se non si attacca né si subiscono danni.",
    vantaggio: { prove: ["FOR"], ts: ["FOR"] } },
  { id: "attacco-sconsiderato", nome: "Attacco Sconsiderato", durata: "1 turno", finisce: "breve", classe: "Barbaro",
    descrizione: "Vantaggio ai tiri per colpire in mischia con la Forza fino al prossimo turno; gli attacchi contro di te hanno vantaggio.",
    vantaggio: { attacchiMischiaFOR: true } },
  { id: "armatura-magica", nome: "Armatura Magica", durata: "8 ore", finisce: "lunga", incantesimo: "Armatura Magica", caBase: 13,
    descrizione: "Senza armatura la CA è 13 + mod DES." },
  { id: "scudo", nome: "Scudo", durata: "fino all'inizio del prossimo turno", finisce: "breve", incantesimo: "Scudo", caBonus: 5,
    descrizione: "+5 alla CA, anche contro l'attacco che l'ha fatto lanciare. Nessun danno da dardo incantato." },
  { id: "scudo-della-fede", nome: "Scudo della Fede", durata: "concentrazione, 10 minuti", finisce: "breve", incantesimo: "Scudo della Fede",
    caBonus: 2,
    descrizione: "+2 alla CA." },
  { id: "pelle-coriacea", nome: "Pelle Coriacea", durata: "concentrazione, 1 ora", finisce: "lunga", incantesimo: "Pelle Coriacea", caMinima: 16,
    descrizione: "La CA non scende sotto 16, qualunque armatura si indossi." },
  { id: "velocita", nome: "Velocità", durata: "concentrazione, 1 minuto", finisce: "breve", incantesimo: "Velocità", caBonus: 2,
    descrizione: "+2 alla CA, vantaggio ai TS di Destrezza, velocità doppia e un'azione in più a turno.",
    vantaggio: { ts: ["DES"] } },
  { id: "immagine-speculare", nome: "Immagine Speculare", durata: "1 minuto", finisce: "breve", incantesimo: "Immagine Speculare", conteggio: 3,
    descrizione: "Duplicati illusori che deviano gli attacchi: con 3 duplicati serve 6+ su d20, con 2 serve 8+, con 1 serve 11+. Un duplicato ha CA 10 + mod DES e sparisce se colpito." },
  { id: "benedizione", nome: "Benedizione", durata: "concentrazione, 1 minuto", finisce: "breve", incantesimo: "Benedizione",
    descrizione: "+1d4 ai tiri per colpire e ai tiri salvezza.",
    notaTiro: { attacco: "Benedizione: aggiungi 1d4 al tiro.", ts: "Benedizione: aggiungi 1d4 al tiro." } },
];

export const effetto = (id: string) => EFFETTI.find(e => e.id === id);

// Il nome dell'incantesimo (senza distinguere le maiuscole) che attiva un effetto.
export const effettoDaIncantesimo = (nome: string) =>
  EFFETTI.find(e => e.incantesimo?.toLowerCase() === nome.trim().toLowerCase());

// --- Vantaggio e svantaggio da condizioni ed effetti ---

export interface ContestoTiro {
  tipo: TipoTiro;
  car?: Caratteristica; // caratteristica della prova o del tiro salvezza
  mischiaFOR?: boolean; // attacco in mischia con la Forza
}

export interface SuggerimentoTiro {
  modalita: Modalita;
  fallimentoAutomatico: boolean;
  note: string[];
}

type StatoEffetti = Pick<CharacterData, "condizioni" | "indebolimento" | "effetti">;

// Cosa dicono le condizioni e gli effetti attivi su un tiro: vantaggio e svantaggio si annullano,
// qualunque sia il loro numero (regola base della 5e).
export function suggerimentoTiro(c: StatoEffetti, x: ContestoTiro): SuggerimentoTiro {
  const vantaggi: string[] = [];
  const svantaggi: string[] = [];
  const note: string[] = [];
  let fallimento = false;

  for (const id of c.condizioni) {
    const def = condizione(id);
    if (!def) continue;
    if (x.tipo === "attacco" && def.attacchi) (def.attacchi === "vantaggio" ? vantaggi : svantaggi).push(def.nome);
    if (x.tipo === "prova" && def.prove) svantaggi.push(def.nome);
    const ts = x.tipo === "ts" && x.car ? def.ts?.[x.car] : undefined;
    if (ts === "svantaggio") svantaggi.push(def.nome);
    if (ts === "fallimento") {
      fallimento = true;
      note.push(`${def.nome}: fallimento automatico.`);
    }
  }

  const stanchezza = `Indebolimento ${c.indebolimento}`;
  if (x.tipo === "prova" && c.indebolimento >= 1) svantaggi.push(stanchezza);
  if (x.tipo !== "prova" && c.indebolimento >= 3) svantaggi.push(stanchezza);

  for (const attivo of c.effetti) {
    const def = effetto(attivo.id);
    if (!def) continue;
    const v = def.vantaggio;
    if (v) {
      if (x.tipo === "attacco" && v.attacchiMischiaFOR && x.mischiaFOR) vantaggi.push(def.nome);
      if (x.tipo === "prova" && x.car && v.prove?.includes(x.car)) vantaggi.push(def.nome);
      if (x.tipo === "ts" && x.car && v.ts?.includes(x.car)) vantaggi.push(def.nome);
    }
    const nota = def.notaTiro?.[x.tipo];
    if (nota) note.push(nota);
  }

  let modalita: Modalita = "normale";
  if (vantaggi.length > 0 && svantaggi.length > 0) {
    note.unshift(`Vantaggio (${vantaggi.join(", ")}) e svantaggio (${svantaggi.join(", ")}) si annullano.`);
  } else if (vantaggi.length > 0) {
    modalita = "vantaggio";
    note.unshift(`Vantaggio: ${vantaggi.join(", ")}.`);
  } else if (svantaggi.length > 0) {
    modalita = "svantaggio";
    note.unshift(`Svantaggio: ${svantaggi.join(", ")}.`);
  }
  return { modalita, fallimentoAutomatico: fallimento, note };
}
