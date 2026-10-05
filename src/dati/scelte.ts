import type { Privilegio } from "../tipi.ts";

// Scelte di privilegio: opzioni che la classe fa scegliere a certi livelli (Metamagia, Stile di Combattimento,
// terreno del Circolo della Terra). Le opzioni sono voci del catalogo `privilegi` con una `fonte` propria
// (server/semi/opzioni.ts); nella scheda quelle scelte sono privilegi con quella fonte.

export interface DefinizioneScelta {
  id: string;
  nome: string;
  fonte: string; // fonte delle opzioni nel catalogo e dei privilegi scelti
  classe: string;
  sottoclasse?: string;
  quante: [number, number][]; // [livello, totale di opzioni scelte da quel livello]
  ammesse?: string[]; // solo queste opzioni (gli stili del Paladino e del Ranger)
}

export const FONTE_METAMAGIA = "Metamagia";
export const FONTE_STILE = "Stile di Combattimento";
export const FONTE_TERRENO = "Terreno del Circolo";

export const STILI = {
  armiPossenti: "Combattere con Armi Possenti",
  dueArmi: "Combattere con Due Armi",
  difesa: "Difesa",
  duellare: "Duellare",
  protezione: "Protezione",
  tiro: "Tiro",
} as const;

export const SCELTE: DefinizioneScelta[] = [
  { id: "metamagia", nome: "Metamagia", fonte: FONTE_METAMAGIA, classe: "Stregone", quante: [[3, 2], [10, 3], [17, 4]] },
  { id: "stile-guerriero", nome: "Stile di Combattimento", fonte: FONTE_STILE, classe: "Guerriero", quante: [[1, 1]] },
  // Il Campione ne sceglie un secondo al 10° livello: sostituisce la voce precedente per la sua sottoclasse.
  { id: "stile-campione", nome: "Stile di Combattimento Aggiuntivo", fonte: FONTE_STILE, classe: "Guerriero", sottoclasse: "Campione", quante: [[1, 1], [10, 2]] },
  {
    id: "stile-paladino", nome: "Stile di Combattimento", fonte: FONTE_STILE, classe: "Paladino", quante: [[2, 1]],
    ammesse: [STILI.armiPossenti, STILI.difesa, STILI.duellare, STILI.protezione],
  },
  {
    id: "stile-ranger", nome: "Stile di Combattimento", fonte: FONTE_STILE, classe: "Ranger", quante: [[2, 1]],
    ammesse: [STILI.dueArmi, STILI.difesa, STILI.duellare, STILI.tiro],
  },
  { id: "terreno", nome: "Terreno del Circolo", fonte: FONTE_TERRENO, classe: "Druido", sottoclasse: "Circolo della Terra", quante: [[3, 1]] },
];

type InfoScelte = { info: { classe: string; sottoclasse: string; livello: number } };

// Le scelte che valgono per il personaggio: per la stessa fonte, quella della sottoclasse prevale su quella di classe.
export function scelteDelPersonaggio(c: InfoScelte): DefinizioneScelta[] {
  const valide = SCELTE.filter(s => s.classe === c.info.classe && (!s.sottoclasse || s.sottoclasse === c.info.sottoclasse));
  return valide.filter(s => s.sottoclasse || !valide.some(x => x.sottoclasse && x.fonte === s.fonte));
}

// Totale di opzioni dovute al livello indicato.
export const totaleScelte = (s: DefinizioneScelta, livello: number) =>
  s.quante.filter(([l]) => livello >= l).at(-1)?.[1] ?? 0;

// Opzioni del catalogo che si possono scegliere per questa scelta.
export const opzioniScelta = (s: DefinizioneScelta, catalogo: Privilegio[]) =>
  catalogo.filter(p => p.fonte === s.fonte && (!s.ammesse || s.ammesse.includes(p.nome)));

// Il personaggio ha scelto questa opzione?
export const haScelto = (c: { privilegi: Privilegio[] }, fonte: string, nome: string) =>
  c.privilegi.some(p => p.fonte === fonte && p.nome === nome);
