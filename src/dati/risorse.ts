import type { Caratteristica } from "../tipi.ts";

// Risorse con usi limitati (Ira, Ki, Incanalare Divinità...) del Manuale del Giocatore (5e 2014).
// Qui ci sono solo le regole: nella scheda si salva quanti usi sono stati spesi (`risorseUsate`),
// il massimo si calcola da livello e caratteristiche.

export type Ricarica = "breve" | "lunga";

export interface ContestoRisorse {
  livello: number;
  mod: (k: Caratteristica) => number;
}

export interface DefinizioneRisorsa {
  id: string;
  nome: string;
  fonte: string; // classe, sottoclasse o razza da cui deriva
  classe?: string;
  sottoclasse?: string;
  razza?: string;
  livello: number; // livello minimo del personaggio
  massimo: (x: ContestoRisorse) => number | null; // null = usi illimitati
  ricarica: Ricarica | ((x: ContestoRisorse) => Ricarica);
  unita?: string; // per le riserve di punti (Imposizione delle Mani)
  nota?: (x: ContestoRisorse) => string | undefined;
}

export interface RisorsaDerivata {
  id: string;
  nome: string;
  fonte: string;
  max: number | null;
  usati: number;
  rimasti: number | null;
  ricarica: Ricarica;
  unita?: string;
  nota?: string;
}

// Valore della tabella per il livello: l'ultima soglia raggiunta (0 se nessuna).
const soglia = (livello: number, tabella: [number, number][]) =>
  tabella.filter(([l]) => livello >= l).at(-1)?.[1] ?? 0;

// Bonus ai danni in mischia con la Forza mentre è in ira.
export const bonusIra = (livello: number) => (livello >= 16 ? 4 : livello >= 9 ? 3 : 2);

// Come "mod, minimo 1" dei privilegi che si usano tante volte quanto il modificatore.
const almenoUno = (n: number) => Math.max(1, n);

const usiDominio = (nome: string, dominio: string): DefinizioneRisorsa => ({
  id: nome.toLowerCase().replace(/\W+/g, "-"), nome, fonte: dominio, classe: "Chierico", sottoclasse: dominio, livello: 1,
  massimo: ({ mod }) => almenoUno(mod("SAG")), ricarica: "lunga",
});

const arcanum = (livelloIncantesimo: number, livello: number): DefinizioneRisorsa => ({
  id: `arcanum-${livelloIncantesimo}`, nome: `Arcanum Mistico (${livelloIncantesimo}° livello)`, fonte: "Warlock", classe: "Warlock",
  livello, massimo: () => 1, ricarica: "lunga",
  nota: () => "Un incantesimo del livello indicato, senza slot, una volta per riposo lungo.",
});

export const RISORSE: DefinizioneRisorsa[] = [
  // Barbaro
  {
    id: "ira", nome: "Ira", fonte: "Barbaro", classe: "Barbaro", livello: 1,
    massimo: ({ livello }) => (livello >= 20 ? null : soglia(livello, [[1, 2], [3, 3], [6, 4], [12, 5], [17, 6]])),
    ricarica: "lunga",
    nota: ({ livello }) => `+${bonusIra(livello)} ai danni in mischia con la Forza`,
  },

  // Bardo: dal 5° livello l'Ispirazione Bardica torna anche con il riposo breve (Fonte di Ispirazione).
  {
    id: "ispirazione-bardica", nome: "Ispirazione Bardica", fonte: "Bardo", classe: "Bardo", livello: 1,
    massimo: ({ mod }) => almenoUno(mod("CAR")),
    ricarica: ({ livello }) => (livello >= 5 ? "breve" : "lunga"),
    nota: ({ livello }) => `d${soglia(livello, [[1, 6], [5, 8], [10, 10], [15, 12]])}`,
  },

  // Chierico
  {
    id: "incanalare-divinita", nome: "Incanalare Divinità", fonte: "Chierico", classe: "Chierico", livello: 2,
    massimo: ({ livello }) => soglia(livello, [[2, 1], [6, 2], [18, 3]]), ricarica: "breve",
  },
  {
    id: "intervento-divino", nome: "Intervento Divino", fonte: "Chierico", classe: "Chierico", livello: 10,
    massimo: () => 1, ricarica: "lunga",
    nota: () => "Se riesce, non si può riusare per 7 giorni (al 20° livello è automatico).",
  },
  usiDominio("Sacerdote Guerriero", "Dominio della Guerra"),
  usiDominio("Bagliore Protettivo", "Dominio della Luce"),
  usiDominio("Ira della Tempesta", "Dominio della Tempesta"),

  // Druido
  {
    id: "forma-selvatica", nome: "Forma Selvatica", fonte: "Druido", classe: "Druido", livello: 2,
    massimo: () => 2, ricarica: "breve",
  },

  // Guerriero
  {
    id: "recuperare-energie", nome: "Recuperare Energie", fonte: "Guerriero", classe: "Guerriero", livello: 1,
    massimo: () => 1, ricarica: "breve",
    nota: ({ livello }) => `Cura 1d10 + ${livello} PF`,
  },
  {
    id: "azione-impetuosa", nome: "Azione Impetuosa", fonte: "Guerriero", classe: "Guerriero", livello: 2,
    massimo: ({ livello }) => (livello >= 17 ? 2 : 1), ricarica: "breve",
  },
  {
    id: "indomito", nome: "Indomito", fonte: "Guerriero", classe: "Guerriero", livello: 9,
    massimo: ({ livello }) => soglia(livello, [[9, 1], [13, 2], [17, 3]]), ricarica: "lunga",
  },
  {
    id: "dadi-superiorita", nome: "Dadi di Superiorità", fonte: "Maestro di Battaglia", classe: "Guerriero",
    sottoclasse: "Maestro di Battaglia", livello: 3,
    massimo: ({ livello }) => soglia(livello, [[3, 4], [7, 5], [15, 6]]), ricarica: "breve",
    nota: ({ livello }) => `d${soglia(livello, [[3, 8], [10, 10], [18, 12]])}`,
  },

  // Ladro
  {
    id: "colpo-di-fortuna", nome: "Colpo di Fortuna", fonte: "Ladro", classe: "Ladro", livello: 20,
    massimo: () => 1, ricarica: "breve",
  },

  // Mago
  {
    id: "terzo-occhio", nome: "Il Terzo Occhio", fonte: "Scuola di Divinazione", classe: "Mago",
    sottoclasse: "Scuola di Divinazione", livello: 10,
    massimo: () => 1, ricarica: "breve",
  },

  // Monaco
  {
    id: "punti-ki", nome: "Punti Ki", fonte: "Monaco", classe: "Monaco", livello: 2,
    massimo: ({ livello }) => livello, ricarica: "breve",
  },

  // Paladino
  {
    id: "imposizione-mani", nome: "Imposizione delle Mani", fonte: "Paladino", classe: "Paladino", livello: 1,
    massimo: ({ livello }) => livello * 5, ricarica: "lunga", unita: "PF",
    nota: () => "Riserva di PF da distribuire; 5 PF curano una malattia o un veleno.",
  },
  {
    id: "percezione-divino", nome: "Percezione del Divino", fonte: "Paladino", classe: "Paladino", livello: 1,
    massimo: ({ mod }) => 1 + Math.max(0, mod("CAR")), ricarica: "lunga",
  },
  {
    id: "incanalare-divinita-paladino", nome: "Incanalare Divinità", fonte: "Paladino", classe: "Paladino", livello: 3,
    massimo: () => 1, ricarica: "breve",
  },
  {
    id: "tocco-purificante", nome: "Tocco Purificante", fonte: "Paladino", classe: "Paladino", livello: 14,
    massimo: ({ mod }) => almenoUno(mod("CAR")), ricarica: "lunga",
  },

  // Stregone
  {
    id: "punti-stregoneria", nome: "Punti Stregoneria", fonte: "Stregone", classe: "Stregone", livello: 2,
    massimo: ({ livello }) => livello, ricarica: "lunga",
  },
  {
    id: "maree-del-caos", nome: "Maree del Caos", fonte: "Magia Selvaggia", classe: "Stregone", sottoclasse: "Magia Selvaggia",
    livello: 1, massimo: () => 1, ricarica: "lunga",
    nota: () => "Torna anche dopo un Impulso di Magia Selvaggia.",
  },
  {
    id: "ali-di-drago", nome: "Ali di Drago", fonte: "Discendenza Draconica", classe: "Stregone", sottoclasse: "Discendenza Draconica",
    livello: 14, massimo: () => 1, ricarica: "lunga",
    nota: () => "Le ali durano finché non si sceglie di ritirarle; una volta per riposo lungo si manifestano senza spendere punti.",
  },

  // Warlock
  {
    id: "presenza-fatata", nome: "Presenza Fatata", fonte: "Il Signore Fatato", classe: "Warlock", sottoclasse: "Il Signore Fatato",
    livello: 1, massimo: () => 1, ricarica: "breve",
  },
  {
    id: "fortuna-oscuro", nome: "Fortuna dell'Oscuro", fonte: "L'Immondo", classe: "Warlock", sottoclasse: "L'Immondo",
    livello: 6, massimo: () => 1, ricarica: "breve",
  },
  arcanum(6, 11), arcanum(7, 13), arcanum(8, 15), arcanum(9, 17),

  // Razze
  {
    id: "arma-a-soffio", nome: "Arma a Soffio", fonte: "Dragonide", razza: "Dragonide", livello: 1,
    massimo: () => 1, ricarica: "breve",
  },
  {
    id: "tenacia-implacabile", nome: "Tenacia Implacabile", fonte: "Mezzorco", razza: "Mezzorco", livello: 1,
    massimo: () => 1, ricarica: "lunga",
  },
];

const stessa = (a: string | undefined, b: string) => a?.toLowerCase() === b.toLowerCase();

const siApplica = (r: DefinizioneRisorsa, info: { classe: string; sottoclasse: string; razza: string; livello: number }) =>
  info.livello >= r.livello
  && (!r.classe || stessa(r.classe, info.classe))
  && (!r.sottoclasse || stessa(r.sottoclasse, info.sottoclasse))
  && (!r.razza || stessa(r.razza, info.razza));

// Le risorse del personaggio con massimo e usi rimasti. `usate`: usi spesi per id (i valori fuori scala si limitano).
export function risorseDelPersonaggio(
  info: { classe: string; sottoclasse: string; razza: string; livello: number },
  mod: (k: Caratteristica) => number,
  usate: Record<string, number>,
): RisorsaDerivata[] {
  const contesto = { livello: info.livello, mod };
  return RISORSE.filter(r => siApplica(r, info)).flatMap((r): RisorsaDerivata[] => {
    const max = r.massimo(contesto);
    if (max !== null && max <= 0) return [];
    const usati = max === null ? 0 : Math.min(max, Math.max(0, usate[r.id] ?? 0));
    return [{
      id: r.id, nome: r.nome, fonte: r.fonte, max, usati, rimasti: max === null ? null : max - usati,
      ricarica: typeof r.ricarica === "function" ? r.ricarica(contesto) : r.ricarica,
      unita: r.unita, nota: r.nota?.(contesto),
    }];
  });
}
