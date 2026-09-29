import type { Arma } from "../../src/tipi.ts";

// Catalogo ufficiale delle armi (creato_da NULL): a ogni avvio aggiorna la tabella `armi` dell'archivio.
export const ARMI: Arma[] = [
  { nome: "Bastone Ferrato", dado: "1d6", dadoVersatile: "1d8", tipoDanno: "Contundente", proprieta: "Versatile", accurata: false },
  { nome: "Pugnale", dado: "1d4", tipoDanno: "Perforante", proprieta: "Accurata, Leggera, Lancio (6/18 m)", accurata: true },
];
