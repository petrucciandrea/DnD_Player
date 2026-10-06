import type { Privilegio } from "../tipi.ts";
import { FONTE_TERRENO } from "./scelte.ts";

// Incantesimi concessi dalla sottoclasse (5e 2014). Nomi come nel catalogo `incantesimi`.
// "sempre": sempre preparati, non contano nel limite (domini, giuramenti, circolo della terra).
// "ampliata": si aggiungono alla lista da cui si scelgono gli incantesimi conosciuti (patroni del Warlock).

// [livello del personaggio da cui si hanno, incantesimi]
export type IncantesimiPerLivello = [number, string[]][];

// Incantesimi del Circolo della Terra, per terreno (scelto come privilegio con fonte "Terreno del Circolo").
export const TERRENI: Record<string, IncantesimiPerLivello> = {
  Artico: [[3, ["Blocca Persone", "Crescita di Spine"]], [5, ["Tempesta di Nevischio", "Lentezza"]], [7, ["Libertà di Movimento", "Tempesta di Ghiaccio"]], [9, ["Comunione con la Natura", "Cono di Freddo"]]],
  Costa: [[3, ["Immagine Speculare", "Passo Velato"]], [5, ["Respirare Sott'Acqua", "Camminare sull'Acqua"]], [7, ["Controllare Acqua", "Libertà di Movimento"]], [9, ["Evocare Elementale", "Scrutare"]]],
  Deserto: [[3, ["Sfocatura", "Silenzio"]], [5, ["Creare Cibo e Acqua", "Protezione dall'Energia"]], [7, ["Avvizzire", "Terreno Illusorio"]], [9, ["Piaga di Insetti", "Muro di Pietra"]]],
  Foresta: [[3, ["Pelle Coriacea", "Movimenti del Ragno"]], [5, ["Invocare il Fulmine", "Crescita Vegetale"]], [7, ["Divinazione", "Libertà di Movimento"]], [9, ["Comunione con la Natura", "Camminare tra gli Alberi"]]],
  Montagna: [[3, ["Movimenti del Ragno", "Crescita di Spine"]], [5, ["Fulmine", "Fondersi nella Pietra"]], [7, ["Scolpire Pietra", "Pelle di Pietra"]], [9, ["Passapareti", "Muro di Pietra"]]],
  Palude: [[3, ["Oscurità", "Freccia Acida di Melf"]], [5, ["Camminare sull'Acqua", "Nube Maleodorante"]], [7, ["Libertà di Movimento", "Localizzare Creatura"]], [9, ["Piaga di Insetti", "Scrutare"]]],
  Prateria: [[3, ["Invisibilità", "Passare Senza Tracce"]], [5, ["Luce Diurna", "Velocità"]], [7, ["Divinazione", "Libertà di Movimento"]], [9, ["Sogno", "Piaga di Insetti"]]],
  Underdark: [[3, ["Movimenti del Ragno", "Ragnatela"]], [5, ["Forma Gassosa", "Nube Maleodorante"]], [7, ["Invisibilità Superiore", "Scolpire Pietra"]], [9, ["Nube Mortale", "Piaga di Insetti"]]],
};

// Domini del Chierico: dal 1°, 3°, 5°, 7° e 9° livello.
const dominio = (a: string[], b: string[], c: string[], d: string[], e: string[]): IncantesimiPerLivello =>
  [[1, a], [3, b], [5, c], [7, d], [9, e]];

export const DOMINI: Record<string, IncantesimiPerLivello> = {
  "Dominio della Conoscenza": dominio(["Comando", "Identificare"], ["Augurio", "Suggestione"], ["Anti-Individuazione", "Parlare con i Morti"], ["Occhio Arcano", "Confusione"], ["Conoscenza delle Leggende", "Scrutare"]),
  "Dominio della Guerra": dominio(["Favore Divino", "Scudo della Fede"], ["Arma Magica", "Arma Spirituale"], ["Manto del Crociato", "Guardiani Spirituali"], ["Libertà di Movimento", "Pelle di Pietra"], ["Colpo Infuocato", "Blocca Mostri"]),
  "Dominio dell'Inganno": dominio(["Charm su Persone", "Camuffare Se Stesso"], ["Immagine Speculare", "Passare Senza Tracce"], ["Intermittenza", "Dissolvi Magie"], ["Porta Dimensionale", "Metamorfosi"], ["Dominare Persone", "Modificare Memoria"]),
  "Dominio della Luce": dominio(["Mani Brucianti", "Luminescenza"], ["Sfera Infuocata", "Raggio Rovente"], ["Luce Diurna", "Palla di Fuoco"], ["Guardiano della Fede", "Muro di Fuoco"], ["Colpo Infuocato", "Scrutare"]),
  "Dominio della Natura": dominio(["Amicizia con gli Animali", "Parlare con gli Animali"], ["Pelle Coriacea", "Crescita di Spine"], ["Crescita Vegetale", "Muro di Vento"], ["Dominare Bestie", "Rampicante Afferrante"], ["Piaga di Insetti", "Camminare tra gli Alberi"]),
  "Dominio della Tempesta": dominio(["Nube di Nebbia", "Onda Tuonante"], ["Folata di Vento", "Frantumare"], ["Invocare il Fulmine", "Tempesta di Nevischio"], ["Controllare Acqua", "Tempesta di Ghiaccio"], ["Onda Distruttiva", "Piaga di Insetti"]),
  "Dominio della Vita": dominio(["Benedizione", "Cura Ferite"], ["Ristorare Inferiore", "Arma Spirituale"], ["Faro di Speranza", "Revivificare"], ["Interdizione alla Morte", "Guardiano della Fede"], ["Cura Ferite di Massa", "Rianimare Morti"]),
};

// Giuramenti del Paladino: dal 3°, 5°, 9°, 13° e 17° livello.
const giuramento = (a: string[], b: string[], c: string[], d: string[], e: string[]): IncantesimiPerLivello =>
  [[3, a], [5, b], [9, c], [13, d], [17, e]];

export const GIURAMENTI: Record<string, IncantesimiPerLivello> = {
  "Giuramento di Devozione": giuramento(["Protezione dal Bene e dal Male", "Santuario"], ["Ristorare Inferiore", "Zona di Verità"], ["Faro di Speranza", "Dissolvi Magie"], ["Libertà di Movimento", "Guardiano della Fede"], ["Comunione", "Colpo Infuocato"]),
  "Giuramento degli Antichi": giuramento(["Colpo Intrappolante", "Parlare con gli Animali"], ["Raggio Lunare", "Passo Velato"], ["Crescita Vegetale", "Protezione dall'Energia"], ["Tempesta di Ghiaccio", "Pelle di Pietra"], ["Comunione con la Natura", "Camminare tra gli Alberi"]),
  "Giuramento di Vendetta": giuramento(["Anatema", "Marchio del Cacciatore"], ["Blocca Persone", "Passo Velato"], ["Velocità", "Protezione dall'Energia"], ["Esilio", "Porta Dimensionale"], ["Blocca Mostri", "Scrutare"]),
};

// Patroni del Warlock: incantesimi di 1°–5° livello, disponibili quando il Warlock può lanciarli (1°, 3°, 5°, 7°, 9°).
const patrono = (a: string[], b: string[], c: string[], d: string[], e: string[]): IncantesimiPerLivello =>
  [[1, a], [3, b], [5, c], [7, d], [9, e]];

export const PATRONI: Record<string, IncantesimiPerLivello> = {
  "Il Signore Fatato": patrono(["Luminescenza", "Sonno"], ["Calmare Emozioni", "Forza Fantasma"], ["Intermittenza", "Crescita Vegetale"], ["Dominare Bestie", "Invisibilità Superiore"], ["Dominare Persone", "Sembrare"]),
  "L'Immondo": patrono(["Mani Brucianti", "Comando"], ["Cecità/Sordità", "Raggio Rovente"], ["Palla di Fuoco", "Nube Maleodorante"], ["Scudo di Fuoco", "Muro di Fuoco"], ["Colpo Infuocato", "Santificare"]),
  "Il Grande Antico": patrono(["Sussurri Dissonanti", "Risata Incontenibile di Tasha"], ["Individuazione dei Pensieri", "Forza Fantasma"], ["Chiaroveggenza", "Inviare"], ["Dominare Bestie", "Tentacoli Neri di Evard"], ["Dominare Persone", "Telecinesi"]),
};

// Tutte le liste, per controllare che il catalogo abbia ogni incantesimo.
export const TUTTE_LE_LISTE: IncantesimiPerLivello[] = [
  ...Object.values(DOMINI), ...Object.values(GIURAMENTI), ...Object.values(TERRENI), ...Object.values(PATRONI),
];

const finoAl = (lista: IncantesimiPerLivello | undefined, livello: number) =>
  (lista ?? []).filter(([l]) => livello >= l).flatMap(([, nomi]) => nomi);

export interface IncantesimiSottoclasse {
  sempre: string[];
  ampliata: string[];
  fonte: string | null; // come si chiamano nel grimorio: "Dominio", "Giuramento", "Circolo", "Patrono"
}

type InfoSottoclasse = { info: { classe: string; sottoclasse: string; livello: number }; privilegi: Privilegio[] };

// Gli incantesimi che la sottoclasse concede fino al livello del personaggio.
export function incantesimiDiSottoclasse(c: InfoSottoclasse): IncantesimiSottoclasse {
  const { classe, sottoclasse, livello } = c.info;
  if (classe === "Chierico" && DOMINI[sottoclasse]) return { sempre: finoAl(DOMINI[sottoclasse], livello), ampliata: [], fonte: "Dominio" };
  if (classe === "Paladino" && GIURAMENTI[sottoclasse]) return { sempre: finoAl(GIURAMENTI[sottoclasse], livello), ampliata: [], fonte: "Giuramento" };
  if (classe === "Druido" && sottoclasse === "Circolo della Terra") {
    const terreno = c.privilegi.find(p => p.fonte === FONTE_TERRENO)?.nome;
    return { sempre: [...new Set(finoAl(terreno ? TERRENI[terreno] : undefined, livello))], ampliata: [], fonte: "Circolo" };
  }
  if (classe === "Warlock" && PATRONI[sottoclasse]) return { sempre: [], ampliata: finoAl(PATRONI[sottoclasse], livello), fonte: "Patrono" };
  return { sempre: [], ampliata: [], fonte: null };
}
