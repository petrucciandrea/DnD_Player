import type { Armatura } from "../tipi.ts";

// Catalogo ufficiale delle armature (creato_da NULL). Lo scudo è una voce a parte con CA +2.
export const ARMATURE: Armatura[] = [
  { nome: "Armatura Imbottita", categoria: "leggera", ca: 11, maxDes: null, forzaMin: 0, svantaggioFurtivita: true, peso: 8 },
  { nome: "Armatura di Cuoio", categoria: "leggera", ca: 11, maxDes: null, forzaMin: 0, svantaggioFurtivita: false, peso: 10 },
  { nome: "Armatura di Cuoio Borchiato", categoria: "leggera", ca: 12, maxDes: null, forzaMin: 0, svantaggioFurtivita: false, peso: 13 },
  { nome: "Armatura di Pelle", categoria: "media", ca: 12, maxDes: 2, forzaMin: 0, svantaggioFurtivita: false, peso: 12 },
  { nome: "Giaco di Maglia", categoria: "media", ca: 13, maxDes: 2, forzaMin: 0, svantaggioFurtivita: false, peso: 20 },
  { nome: "Armatura di Scaglie", categoria: "media", ca: 14, maxDes: 2, forzaMin: 0, svantaggioFurtivita: true, peso: 45 },
  { nome: "Corazza di Piastre", categoria: "media", ca: 14, maxDes: 2, forzaMin: 0, svantaggioFurtivita: false, peso: 20 },
  { nome: "Mezza Armatura", categoria: "media", ca: 15, maxDes: 2, forzaMin: 0, svantaggioFurtivita: true, peso: 40 },
  { nome: "Armatura ad Anelli", categoria: "pesante", ca: 14, maxDes: 0, forzaMin: 0, svantaggioFurtivita: true, peso: 40 },
  { nome: "Cotta di Maglia", categoria: "pesante", ca: 16, maxDes: 0, forzaMin: 13, svantaggioFurtivita: true, peso: 55 },
  { nome: "Armatura a Strisce", categoria: "pesante", ca: 17, maxDes: 0, forzaMin: 15, svantaggioFurtivita: true, peso: 60 },
  { nome: "Armatura di Piastre", categoria: "pesante", ca: 18, maxDes: 0, forzaMin: 15, svantaggioFurtivita: true, peso: 65 },
];

export const SCUDO = { nome: "Scudo", bonus: 2, peso: 6 };
