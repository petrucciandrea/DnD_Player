import type { Arma, CharacterData } from "../tipi.ts";

// Competenze in armi e armature (5e 2014). Classi e razze le indicano al plurale ("Pugnali",
// "Spade lunghe"), il catalogo delle armi al singolare ("Pugnale", "Spada Lunga"): qui si confrontano.
// Nessun import da regole.ts: questo file lo usa anche dati/condizioni.ts.

// Plurale della competenza → nome dell'arma nel catalogo.
const PLURALI: Record<string, string> = {
  "alabarde": "Alabarda",
  "archi corti": "Arco Corto",
  "archi lunghi": "Arco Lungo",
  "asce": "Ascia",
  "asce bipenni": "Ascia Bipenne",
  "asce da battaglia": "Ascia da Battaglia",
  "balestre a mano": "Balestra a Mano",
  "balestre leggere": "Balestra Leggera",
  "balestre pesanti": "Balestra Pesante",
  "bastoni ferrati": "Bastone Ferrato",
  "cerbottane": "Cerbottana",
  "dardi": "Dardo",
  "falcetti": "Falcetto",
  "falcioni": "Falcione",
  "fionde": "Fionda",
  "fruste": "Frusta",
  "giavellotti": "Giavellotto",
  "lance": "Lancia",
  "lance da cavaliere": "Lancia da Cavaliere",
  "magli": "Maglio",
  "martelli da guerra": "Martello da Guerra",
  "martelli leggeri": "Martello Leggero",
  "mazze": "Mazza",
  "mazzafrusti": "Mazzafrusto",
  "morning star": "Morning Star",
  "picche": "Picca",
  "picconi da guerra": "Piccone da Guerra",
  "pugnali": "Pugnale",
  "randelli": "Randello",
  "randelli pesanti": "Randello Pesante",
  "scimitarre": "Scimitarra",
  "spade corte": "Spada Corta",
  "spade lunghe": "Spada Lunga",
  "spadoni": "Spadone",
  "stocchi": "Stocco",
  "tridenti": "Tridente",
};

const norma = (s: string) => s.trim().toLowerCase();

// Suggerimenti per aggiungere a mano una competenza nelle armi.
export const COMPETENZE_ARMI = [
  "Armi semplici", "Armi da guerra",
  ...Object.keys(PLURALI).map(p => p.charAt(0).toUpperCase() + p.slice(1)),
];

// Una competenza copre l'arma se è la sua categoria, il suo nome o il suo nome al plurale.
export function competenzaCopreArma(competenza: string, arma: Pick<Arma, "nome" | "categoria">): boolean {
  const c = norma(competenza);
  if (c === "armi semplici") return arma.categoria === "semplice";
  if (c === "armi da guerra") return arma.categoria === "guerra";
  const nome = norma(arma.nome);
  return c === nome || norma(PLURALI[c] ?? "") === nome;
}

type Competenze = Pick<CharacterData, "competenzeAltre">;

// Un'arma senza categoria (personalizzata di un vecchio salvataggio) si considera semplice.
export const competenteArma = (c: Competenze, arma: Pick<Arma, "nome" | "categoria">) =>
  c.competenzeAltre.armi.some(x => competenzaCopreArma(x, { ...arma, categoria: arma.categoria ?? "semplice" }));

const CATEGORIE_ARMATURA = { leggera: "armature leggere", media: "armature medie", pesante: "armature pesanti" } as const;

// Armatura e scudo indossati coperti dalle competenze. Senza armatura né scudo si è sempre competenti.
export function competenteArmatura(c: Competenze & Pick<CharacterData, "armatura" | "scudo">): boolean {
  const possedute = c.competenzeAltre.armature.map(norma);
  const tutte = possedute.includes("tutte le armature");
  const armatura = !c.armatura || tutte || possedute.includes(CATEGORIE_ARMATURA[c.armatura.categoria]);
  const scudo = !c.scudo || possedute.some(x => x.startsWith("scudi"));
  return armatura && scudo;
}
