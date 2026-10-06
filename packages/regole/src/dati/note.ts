import type { CategoriaNota } from "../tipi.ts";

// Campi specifici di ogni categoria di nota. Nella scheda si salvano come { id campo: valore }.

export interface CampoNota {
  id: string;
  etichetta: string;
  tipo: "testo" | "scelta"; // "scelta": solo le opzioni elencate
  opzioni?: string[];
  suggerimenti?: "razze" | "classi" | "png"; // valori proposti, ma si può scrivere altro
}

export interface CategoriaDefinita {
  id: CategoriaNota;
  etichetta: string;
  titolo: string; // segnaposto del titolo
  colore: string;
  campi: CampoNota[];
}

export const CATEGORIE_NOTA: CategoriaDefinita[] = [
  {
    id: "sessione", etichetta: "Sessione", titolo: "Titolo della sessione",
    colore: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
    campi: [
      { id: "numero", etichetta: "Sessione n.", tipo: "testo" },
      { id: "dataGioco", etichetta: "Data nel mondo di gioco", tipo: "testo" },
      { id: "luogo", etichetta: "Luogo", tipo: "testo" },
    ],
  },
  {
    id: "png", etichetta: "PNG", titolo: "Nome",
    colore: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    campi: [
      { id: "razza", etichetta: "Razza", tipo: "testo", suggerimenti: "razze" },
      { id: "classe", etichetta: "Classe", tipo: "testo", suggerimenti: "classi" },
      { id: "ruolo", etichetta: "Ruolo / occupazione", tipo: "testo" },
      { id: "luogo", etichetta: "Dove si trova", tipo: "testo" },
      { id: "fazione", etichetta: "Fazione", tipo: "testo" },
      { id: "atteggiamento", etichetta: "Atteggiamento", tipo: "scelta", opzioni: ["Amichevole", "Indifferente", "Ostile"] },
      { id: "stato", etichetta: "Stato", tipo: "scelta", opzioni: ["Vivo", "Morto", "Scomparso", "Sconosciuto"] },
    ],
  },
  {
    id: "obiettivo", etichetta: "Obiettivo", titolo: "Obiettivo",
    colore: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    campi: [
      { id: "committente", etichetta: "Committente", tipo: "testo", suggerimenti: "png" },
      { id: "ricompensa", etichetta: "Ricompensa", tipo: "testo" },
      { id: "priorita", etichetta: "Priorità", tipo: "scelta", opzioni: ["Alta", "Media", "Bassa"] },
      { id: "scadenza", etichetta: "Scadenza", tipo: "testo" },
    ],
  },
  {
    id: "altro", etichetta: "Altro", titolo: "Titolo",
    colore: "bg-slate-500/15 text-slate-300 border-slate-500/30",
    campi: [],
  },
];

export const categoriaNota = (id: CategoriaNota) => CATEGORIE_NOTA.find(c => c.id === id) ?? CATEGORIE_NOTA[3];

// Colore dei valori delle scelte che si vedono a colpo d'occhio (atteggiamento e stato dei PNG, priorità).
export const COLORI_SCELTA: Record<string, string> = {
  Amichevole: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
  Indifferente: "text-slate-300 border-slate-500/40 bg-slate-500/10",
  Ostile: "text-rose-300 border-rose-500/40 bg-rose-500/10",
  Morto: "text-rose-300 border-rose-500/40 bg-rose-500/10",
  Scomparso: "text-amber-300 border-amber-500/40 bg-amber-500/10",
  Alta: "text-rose-300 border-rose-500/40 bg-rose-500/10",
};
