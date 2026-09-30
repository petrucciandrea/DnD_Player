import type { Privilegio } from "../../src/tipi.ts";
import { BACKGROUND } from "./background.ts";
import { PRIVILEGI_CLASSE } from "./classi.ts";
import { RAZZE } from "./razze.ts";
import { OPZIONI_PRIVILEGIO } from "./opzioni.ts";

// Catalogo ufficiale dei privilegi (creato_da NULL): tutti quelli di razze, background e classi,
// più le opzioni delle scelte di privilegio (Metamagia, Stile di Combattimento, terreno del circolo).
// Una voce è identificata da nome + fonte: lo stesso nome può avere effetti diversi (es. Scurovisione).
const tutti: Privilegio[] = [
  ...RAZZE.flatMap(r => r.privilegi),
  ...BACKGROUND.map(b => b.privilegio),
  ...PRIVILEGI_CLASSE.map(c => c.privilegio),
  ...OPZIONI_PRIVILEGIO,
];

const chiave = (p: Privilegio) => `${p.nome.toLowerCase()}|${p.fonte.toLowerCase()}`;

export const PRIVILEGI: Privilegio[] = [...new Map(tutti.map(p => [chiave(p), p])).values()];
