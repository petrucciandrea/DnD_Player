import type { Arma } from "../../src/tipi.ts";

// Catalogo ufficiale delle armi (creato_da NULL): a ogni avvio aggiorna la tabella `armi` dell'archivio.
// Armi semplici e da guerra del Manuale del Giocatore 2014. Le gittate sono in metri (normale/lunga).

const semplice = (a: Omit<Arma, "categoria">): Arma => ({ ...a, categoria: "semplice" });
const guerra = (a: Omit<Arma, "categoria">): Arma => ({ ...a, categoria: "guerra" });

export const ARMI: Arma[] = [
  // Semplici da mischia
  semplice({ nome: "Ascia", dado: "1d6", tipoDanno: "Tagliente", proprieta: "Leggera, Lancio (6/18 m)", accurata: false }),
  semplice({ nome: "Bastone Ferrato", dado: "1d6", dadoVersatile: "1d8", tipoDanno: "Contundente", proprieta: "Versatile", accurata: false }),
  semplice({ nome: "Falcetto", dado: "1d4", tipoDanno: "Tagliente", proprieta: "Leggera", accurata: false }),
  semplice({ nome: "Giavellotto", dado: "1d6", tipoDanno: "Perforante", proprieta: "Lancio (9/36 m)", accurata: false }),
  semplice({ nome: "Lancia", dado: "1d6", dadoVersatile: "1d8", tipoDanno: "Perforante", proprieta: "Lancio (6/18 m), Versatile", accurata: false }),
  semplice({ nome: "Martello Leggero", dado: "1d4", tipoDanno: "Contundente", proprieta: "Leggera, Lancio (6/18 m)", accurata: false }),
  semplice({ nome: "Mazza", dado: "1d6", tipoDanno: "Contundente", proprieta: "", accurata: false }),
  semplice({ nome: "Pugnale", dado: "1d4", tipoDanno: "Perforante", proprieta: "Accurata, Leggera, Lancio (6/18 m)", accurata: true }),
  semplice({ nome: "Randello", dado: "1d4", tipoDanno: "Contundente", proprieta: "Leggera", accurata: false }),
  semplice({ nome: "Randello Pesante", dado: "1d8", tipoDanno: "Contundente", proprieta: "Due mani", accurata: false }),
  // Semplici a distanza
  semplice({ nome: "Arco Corto", dado: "1d6", tipoDanno: "Perforante", proprieta: "Munizioni (24/96 m), Due mani", accurata: false, distanza: true }),
  semplice({ nome: "Balestra Leggera", dado: "1d8", tipoDanno: "Perforante", proprieta: "Munizioni (24/96 m), Ricarica, Due mani", accurata: false, distanza: true }),
  semplice({ nome: "Dardo", dado: "1d4", tipoDanno: "Perforante", proprieta: "Accurata, Lancio (6/18 m)", accurata: true, distanza: true }),
  semplice({ nome: "Fionda", dado: "1d4", tipoDanno: "Contundente", proprieta: "Munizioni (9/36 m)", accurata: false, distanza: true }),
  // Da guerra da mischia
  guerra({ nome: "Alabarda", dado: "1d10", tipoDanno: "Tagliente", proprieta: "Pesante, Portata, Due mani", accurata: false }),
  guerra({ nome: "Ascia Bipenne", dado: "1d12", tipoDanno: "Tagliente", proprieta: "Pesante, Due mani", accurata: false }),
  guerra({ nome: "Ascia da Battaglia", dado: "1d8", dadoVersatile: "1d10", tipoDanno: "Tagliente", proprieta: "Versatile", accurata: false }),
  guerra({ nome: "Falcione", dado: "1d10", tipoDanno: "Tagliente", proprieta: "Pesante, Portata, Due mani", accurata: false }),
  guerra({ nome: "Frusta", dado: "1d4", tipoDanno: "Tagliente", proprieta: "Accurata, Portata", accurata: true }),
  guerra({ nome: "Lancia da Cavaliere", dado: "1d12", tipoDanno: "Perforante", proprieta: "Portata, Speciale", accurata: false }),
  guerra({ nome: "Maglio", dado: "2d6", tipoDanno: "Contundente", proprieta: "Pesante, Due mani", accurata: false }),
  guerra({ nome: "Martello da Guerra", dado: "1d8", dadoVersatile: "1d10", tipoDanno: "Contundente", proprieta: "Versatile", accurata: false }),
  guerra({ nome: "Mazzafrusto", dado: "1d8", tipoDanno: "Contundente", proprieta: "", accurata: false }),
  guerra({ nome: "Morning Star", dado: "1d8", tipoDanno: "Perforante", proprieta: "", accurata: false }),
  guerra({ nome: "Picca", dado: "1d10", tipoDanno: "Perforante", proprieta: "Pesante, Portata, Due mani", accurata: false }),
  guerra({ nome: "Piccone da Guerra", dado: "1d8", tipoDanno: "Perforante", proprieta: "", accurata: false }),
  guerra({ nome: "Scimitarra", dado: "1d6", tipoDanno: "Tagliente", proprieta: "Accurata, Leggera", accurata: true }),
  guerra({ nome: "Spada Corta", dado: "1d6", tipoDanno: "Perforante", proprieta: "Accurata, Leggera", accurata: true }),
  guerra({ nome: "Spada Lunga", dado: "1d8", dadoVersatile: "1d10", tipoDanno: "Tagliente", proprieta: "Versatile", accurata: false }),
  guerra({ nome: "Spadone", dado: "2d6", tipoDanno: "Tagliente", proprieta: "Pesante, Due mani", accurata: false }),
  guerra({ nome: "Stocco", dado: "1d8", tipoDanno: "Perforante", proprieta: "Accurata", accurata: true }),
  guerra({ nome: "Tridente", dado: "1d6", dadoVersatile: "1d8", tipoDanno: "Perforante", proprieta: "Lancio (6/18 m), Versatile", accurata: false }),
  // Da guerra a distanza
  guerra({ nome: "Arco Lungo", dado: "1d8", tipoDanno: "Perforante", proprieta: "Munizioni (45/180 m), Pesante, Due mani", accurata: false, distanza: true }),
  guerra({ nome: "Balestra a Mano", dado: "1d6", tipoDanno: "Perforante", proprieta: "Munizioni (9/36 m), Leggera, Ricarica", accurata: false, distanza: true }),
  guerra({ nome: "Balestra Pesante", dado: "1d10", tipoDanno: "Perforante", proprieta: "Munizioni (30/120 m), Pesante, Ricarica, Due mani", accurata: false, distanza: true }),
  guerra({ nome: "Cerbottana", dado: "1d1", tipoDanno: "Perforante", proprieta: "Munizioni (7,5/30 m), Ricarica", accurata: false, distanza: true }),
];
