import type { Caratteristica } from "../tipi.ts";

// Regole delle 12 classi del Manuale del Giocatore (D&D 5e 2014). I testi dei privilegi di classe
// stanno nel catalogo `privilegi` dell'archivio; qui c'è solo ciò che serve ai calcoli e alla creazione.
// Le abilità sono indicate con gli id di ABILITA (regole.ts).

export type NomeClasse =
  | "Barbaro" | "Bardo" | "Chierico" | "Druido" | "Guerriero" | "Ladro"
  | "Mago" | "Monaco" | "Paladino" | "Ranger" | "Stregone" | "Warlock";

// completo: Bardo, Chierico, Druido, Mago, Stregone. mezzo: Paladino, Ranger (dal 2° livello).
// terzo: sottoclassi di Guerriero e Ladro (dal 3°). patto: Warlock, slot tutti dello stesso livello.
export type TipoIncantatore = "completo" | "mezzo" | "terzo" | "patto";

// preparati: sceglie ogni giorno dall'intera lista della classe. libro: prepara dal libro degli incantesimi.
// conosciuti: lancia solo quelli che conosce, senza prepararli.
export type ModoIncantesimi = "preparati" | "libro" | "conosciuti";

export interface Incantatore {
  caratteristica: Caratteristica;
  tipo: TipoIncantatore;
  modo: ModoIncantesimi;
  trucchetti: number[]; // per livello del personaggio (indice = livello - 1)
  conosciuti?: number[]; // solo per modo "conosciuti"
  preparatiMetaLivello?: boolean; // Paladino: metà livello (per difetto) + modificatore
}

// Una voce di equipaggiamento: un oggetto preciso dei cataloghi (arma, armatura) o dello zaino,
// oppure un'arma a scelta di una categoria.
export type VoceEquipaggiamento =
  | { tipo: "arma"; nome: string; qta?: number }
  | { tipo: "armatura"; nome: string } // compreso lo scudo
  | { tipo: "oggetto"; nome: string; qta?: number; peso: number }
  | { tipo: "armaAScelta"; categoria: "semplice" | "guerra"; soloMischia?: boolean; qta?: number };

export interface OpzioneEquipaggiamento {
  etichetta: string;
  voci: VoceEquipaggiamento[];
}

// Un gruppo con una sola opzione è equipaggiamento fisso.
export type GruppoEquipaggiamento = OpzioneEquipaggiamento[];

export interface RegoleClasse {
  dadoVita: number;
  tiriSalvezza: [Caratteristica, Caratteristica];
  abilita: { numero: number; lista: string[] | "tutte" };
  armature: string[];
  armi: string[];
  strumenti: string[];
  strumentiAScelta?: { numero: number; tra: "musicali" | "artigianoOMusicali" };
  incantatore: Incantatore | null;
  livelloSottoclasse: number;
  sottoclassi: string[];
  sottoclassiIncantatrici?: Record<string, Incantatore>; // terzi incantatori
  difesaSenzaArmatura?: Caratteristica; // 10 + DES + questa caratteristica, senza armatura
  equipaggiamento: GruppoEquipaggiamento[];
}

// Tabelle per livello 1–20.
const perLivello = (soglie: [number, number][]) =>
  Array.from({ length: 20 }, (_, i) => soglie.filter(([livello]) => i + 1 >= livello).at(-1)?.[1] ?? 0);

const TRUCCHETTI_2_3_4 = perLivello([[1, 2], [4, 3], [10, 4]]);
const TRUCCHETTI_3_4_5 = perLivello([[1, 3], [4, 4], [10, 5]]);

const PACCHETTO = {
  avventuriero: { tipo: "oggetto", nome: "Dotazione da avventuriero", peso: 61.5 },
  diplomatico: { tipo: "oggetto", nome: "Dotazione da diplomatico", peso: 36 },
  esploratore: { tipo: "oggetto", nome: "Dotazione da esploratore", peso: 59 },
  intrattenitore: { tipo: "oggetto", nome: "Dotazione da intrattenitore", peso: 38 },
  sacerdote: { tipo: "oggetto", nome: "Dotazione da sacerdote", peso: 24 },
  scassinatore: { tipo: "oggetto", nome: "Dotazione da scassinatore", peso: 44.5 },
  studioso: { tipo: "oggetto", nome: "Dotazione da studioso", peso: 10 },
} as const satisfies Record<string, VoceEquipaggiamento>;

const pacchetti = (...nomi: (keyof typeof PACCHETTO)[]): GruppoEquipaggiamento =>
  nomi.map(n => ({ etichetta: PACCHETTO[n].nome, voci: [PACCHETTO[n]] }));

const fisso = (...voci: VoceEquipaggiamento[]): GruppoEquipaggiamento => [{ etichetta: "Sempre", voci }];

const FRECCE: VoceEquipaggiamento = { tipo: "oggetto", nome: "Faretra con 20 frecce", peso: 2 };
const QUADRELLI: VoceEquipaggiamento = { tipo: "oggetto", nome: "Custodia con 20 quadrelli", peso: 2.5 };
const BORSA_COMPONENTI: VoceEquipaggiamento = { tipo: "oggetto", nome: "Borsa per componenti", peso: 2 };
const FOCUS_ARCANO: VoceEquipaggiamento = { tipo: "oggetto", nome: "Focus arcano", peso: 1 };
const SIMBOLO_SACRO: VoceEquipaggiamento = { tipo: "oggetto", nome: "Simbolo sacro", peso: 1 };

// Competenze nelle armi di Mago e Stregone.
const ARMI_DA_INCANTATORE = ["Balestre leggere", "Bastoni ferrati", "Dardi", "Fionde", "Pugnali"];

export const CLASSI: Record<NomeClasse, RegoleClasse> = {
  Barbaro: {
    dadoVita: 12,
    tiriSalvezza: ["FOR", "COS"],
    abilita: { numero: 2, lista: ["addestrareAnimali", "atletica", "intimidire", "natura", "percezione", "sopravvivenza"] },
    armature: ["Armature leggere", "Armature medie", "Scudi"],
    armi: ["Armi semplici", "Armi da guerra"],
    strumenti: [],
    incantatore: null,
    livelloSottoclasse: 3,
    sottoclassi: ["Cammino del Berserker", "Cammino del Combattente Totemico"],
    difesaSenzaArmatura: "COS",
    equipaggiamento: [
      [
        { etichetta: "Ascia bipenne", voci: [{ tipo: "arma", nome: "Ascia Bipenne" }] },
        { etichetta: "Un'arma da guerra da mischia", voci: [{ tipo: "armaAScelta", categoria: "guerra", soloMischia: true }] },
      ],
      [
        { etichetta: "Due asce", voci: [{ tipo: "arma", nome: "Ascia", qta: 2 }] },
        { etichetta: "Un'arma semplice", voci: [{ tipo: "armaAScelta", categoria: "semplice" }] },
      ],
      fisso(PACCHETTO.esploratore, { tipo: "arma", nome: "Giavellotto", qta: 4 }),
    ],
  },
  Bardo: {
    dadoVita: 8,
    tiriSalvezza: ["DES", "CAR"],
    abilita: { numero: 3, lista: "tutte" },
    armature: ["Armature leggere"],
    armi: ["Armi semplici", "Balestre a mano", "Spade lunghe", "Stocchi", "Spade corte"],
    strumenti: [],
    strumentiAScelta: { numero: 3, tra: "musicali" },
    incantatore: {
      caratteristica: "CAR", tipo: "completo", modo: "conosciuti", trucchetti: TRUCCHETTI_2_3_4,
      conosciuti: [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 19, 20, 22, 22, 22],
    },
    livelloSottoclasse: 3,
    sottoclassi: ["Collegio della Sapienza", "Collegio del Valore"],
    equipaggiamento: [
      [
        { etichetta: "Stocco", voci: [{ tipo: "arma", nome: "Stocco" }] },
        { etichetta: "Spada lunga", voci: [{ tipo: "arma", nome: "Spada Lunga" }] },
        { etichetta: "Un'arma semplice", voci: [{ tipo: "armaAScelta", categoria: "semplice" }] },
      ],
      pacchetti("diplomatico", "intrattenitore"),
      [
        { etichetta: "Liuto", voci: [{ tipo: "oggetto", nome: "Liuto", peso: 2 }] },
        { etichetta: "Un altro strumento musicale", voci: [{ tipo: "oggetto", nome: "Strumento musicale", peso: 3 }] },
      ],
      fisso({ tipo: "armatura", nome: "Armatura di Cuoio" }, { tipo: "arma", nome: "Pugnale" }),
    ],
  },
  Chierico: {
    dadoVita: 8,
    tiriSalvezza: ["SAG", "CAR"],
    abilita: { numero: 2, lista: ["intuizione", "medicina", "persuasione", "religione", "storia"] },
    armature: ["Armature leggere", "Armature medie", "Scudi"],
    armi: ["Armi semplici"],
    strumenti: [],
    incantatore: { caratteristica: "SAG", tipo: "completo", modo: "preparati", trucchetti: TRUCCHETTI_3_4_5 },
    livelloSottoclasse: 1,
    sottoclassi: [
      "Dominio della Conoscenza", "Dominio della Guerra", "Dominio dell'Inganno", "Dominio della Luce",
      "Dominio della Natura", "Dominio della Tempesta", "Dominio della Vita",
    ],
    equipaggiamento: [
      [
        { etichetta: "Mazza", voci: [{ tipo: "arma", nome: "Mazza" }] },
        { etichetta: "Martello da guerra (se competente)", voci: [{ tipo: "arma", nome: "Martello da Guerra" }] },
      ],
      [
        { etichetta: "Armatura di scaglie", voci: [{ tipo: "armatura", nome: "Armatura di Scaglie" }] },
        { etichetta: "Armatura di cuoio", voci: [{ tipo: "armatura", nome: "Armatura di Cuoio" }] },
        { etichetta: "Cotta di maglia (se competente)", voci: [{ tipo: "armatura", nome: "Cotta di Maglia" }] },
      ],
      [
        { etichetta: "Balestra leggera e 20 quadrelli", voci: [{ tipo: "arma", nome: "Balestra Leggera" }, QUADRELLI] },
        { etichetta: "Un'arma semplice", voci: [{ tipo: "armaAScelta", categoria: "semplice" }] },
      ],
      pacchetti("sacerdote", "esploratore"),
      fisso({ tipo: "armatura", nome: "Scudo" }, SIMBOLO_SACRO),
    ],
  },
  Druido: {
    dadoVita: 8,
    tiriSalvezza: ["INT", "SAG"],
    abilita: {
      numero: 2,
      lista: ["addestrareAnimali", "arcano", "intuizione", "medicina", "natura", "percezione", "religione", "sopravvivenza"],
    },
    armature: ["Armature leggere", "Armature medie", "Scudi (non di metallo)"],
    armi: ["Bastoni ferrati", "Dardi", "Falcetti", "Fionde", "Giavellotti", "Lance", "Mazze", "Pugnali", "Randelli", "Scimitarre"],
    strumenti: ["Borsa da erborista"],
    incantatore: { caratteristica: "SAG", tipo: "completo", modo: "preparati", trucchetti: TRUCCHETTI_2_3_4 },
    livelloSottoclasse: 2,
    sottoclassi: ["Circolo della Terra", "Circolo della Luna"],
    equipaggiamento: [
      [
        { etichetta: "Scudo di legno", voci: [{ tipo: "armatura", nome: "Scudo" }] },
        { etichetta: "Un'arma semplice", voci: [{ tipo: "armaAScelta", categoria: "semplice" }] },
      ],
      [
        { etichetta: "Scimitarra", voci: [{ tipo: "arma", nome: "Scimitarra" }] },
        { etichetta: "Un'arma semplice da mischia", voci: [{ tipo: "armaAScelta", categoria: "semplice", soloMischia: true }] },
      ],
      fisso({ tipo: "armatura", nome: "Armatura di Cuoio" }, PACCHETTO.esploratore, { tipo: "oggetto", nome: "Focus druidico", peso: 1 }),
    ],
  },
  Guerriero: {
    dadoVita: 10,
    tiriSalvezza: ["FOR", "COS"],
    abilita: {
      numero: 2,
      lista: ["acrobazia", "addestrareAnimali", "atletica", "intimidire", "intuizione", "percezione", "sopravvivenza", "storia"],
    },
    armature: ["Tutte le armature", "Scudi"],
    armi: ["Armi semplici", "Armi da guerra"],
    strumenti: [],
    incantatore: null,
    livelloSottoclasse: 3,
    sottoclassi: ["Campione", "Maestro di Battaglia", "Cavaliere Mistico"],
    sottoclassiIncantatrici: {
      "Cavaliere Mistico": {
        caratteristica: "INT", tipo: "terzo", modo: "conosciuti",
        trucchetti: perLivello([[3, 2], [10, 3]]),
        conosciuti: perLivello([[3, 3], [4, 4], [7, 5], [8, 6], [10, 7], [11, 8], [13, 9], [14, 10], [16, 11], [19, 12], [20, 13]]),
      },
    },
    equipaggiamento: [
      [
        { etichetta: "Cotta di maglia", voci: [{ tipo: "armatura", nome: "Cotta di Maglia" }] },
        {
          etichetta: "Armatura di cuoio, arco lungo e 20 frecce",
          voci: [{ tipo: "armatura", nome: "Armatura di Cuoio" }, { tipo: "arma", nome: "Arco Lungo" }, FRECCE],
        },
      ],
      [
        { etichetta: "Un'arma da guerra e uno scudo", voci: [{ tipo: "armaAScelta", categoria: "guerra" }, { tipo: "armatura", nome: "Scudo" }] },
        { etichetta: "Due armi da guerra", voci: [{ tipo: "armaAScelta", categoria: "guerra" }, { tipo: "armaAScelta", categoria: "guerra" }] },
      ],
      [
        { etichetta: "Balestra leggera e 20 quadrelli", voci: [{ tipo: "arma", nome: "Balestra Leggera" }, QUADRELLI] },
        { etichetta: "Due asce", voci: [{ tipo: "arma", nome: "Ascia", qta: 2 }] },
      ],
      pacchetti("avventuriero", "esploratore"),
    ],
  },
  Ladro: {
    dadoVita: 8,
    tiriSalvezza: ["DES", "INT"],
    abilita: {
      numero: 4,
      lista: [
        "acrobazia", "atletica", "furtivita", "indagare", "inganno", "intimidire", "intrattenere", "intuizione",
        "percezione", "persuasione", "rapiditaDiMano",
      ],
    },
    armature: ["Armature leggere"],
    armi: ["Armi semplici", "Balestre a mano", "Spade lunghe", "Stocchi", "Spade corte"],
    strumenti: ["Arnesi da scasso"],
    incantatore: null,
    livelloSottoclasse: 3,
    sottoclassi: ["Furfante", "Assassino", "Mistificatore Arcano"],
    sottoclassiIncantatrici: {
      "Mistificatore Arcano": {
        caratteristica: "INT", tipo: "terzo", modo: "conosciuti",
        trucchetti: perLivello([[3, 3], [10, 4]]),
        conosciuti: perLivello([[3, 3], [4, 4], [7, 5], [8, 6], [10, 7], [11, 8], [13, 9], [14, 10], [16, 11], [19, 12], [20, 13]]),
      },
    },
    equipaggiamento: [
      [
        { etichetta: "Stocco", voci: [{ tipo: "arma", nome: "Stocco" }] },
        { etichetta: "Spada corta", voci: [{ tipo: "arma", nome: "Spada Corta" }] },
      ],
      [
        { etichetta: "Arco corto e 20 frecce", voci: [{ tipo: "arma", nome: "Arco Corto" }, FRECCE] },
        { etichetta: "Spada corta", voci: [{ tipo: "arma", nome: "Spada Corta" }] },
      ],
      pacchetti("scassinatore", "avventuriero", "esploratore"),
      fisso(
        { tipo: "armatura", nome: "Armatura di Cuoio" }, { tipo: "arma", nome: "Pugnale", qta: 2 },
        { tipo: "oggetto", nome: "Arnesi da scasso", peso: 1 },
      ),
    ],
  },
  Mago: {
    dadoVita: 6,
    tiriSalvezza: ["INT", "SAG"],
    abilita: { numero: 2, lista: ["arcano", "indagare", "intuizione", "medicina", "religione", "storia"] },
    armature: [],
    armi: ARMI_DA_INCANTATORE,
    strumenti: [],
    incantatore: { caratteristica: "INT", tipo: "completo", modo: "libro", trucchetti: TRUCCHETTI_3_4_5 },
    livelloSottoclasse: 2,
    sottoclassi: [
      "Scuola di Abiurazione", "Scuola di Ammaliamento", "Scuola di Divinazione", "Scuola di Evocazione",
      "Scuola di Illusione", "Scuola di Invocazione", "Scuola di Necromanzia", "Scuola di Trasmutazione",
    ],
    equipaggiamento: [
      [
        { etichetta: "Bastone ferrato", voci: [{ tipo: "arma", nome: "Bastone Ferrato" }] },
        { etichetta: "Pugnale", voci: [{ tipo: "arma", nome: "Pugnale" }] },
      ],
      [
        { etichetta: "Borsa per componenti", voci: [BORSA_COMPONENTI] },
        { etichetta: "Focus arcano", voci: [FOCUS_ARCANO] },
      ],
      pacchetti("studioso", "esploratore"),
      fisso({ tipo: "oggetto", nome: "Libro degli Incantesimi", peso: 3 }),
    ],
  },
  Monaco: {
    dadoVita: 8,
    tiriSalvezza: ["FOR", "DES"],
    abilita: { numero: 2, lista: ["acrobazia", "atletica", "furtivita", "intuizione", "religione", "storia"] },
    armature: [],
    armi: ["Armi semplici", "Spade corte"],
    strumenti: [],
    strumentiAScelta: { numero: 1, tra: "artigianoOMusicali" },
    incantatore: null,
    livelloSottoclasse: 3,
    sottoclassi: ["Via della Mano Aperta", "Via dell'Ombra", "Via dei Quattro Elementi"],
    difesaSenzaArmatura: "SAG",
    equipaggiamento: [
      [
        { etichetta: "Spada corta", voci: [{ tipo: "arma", nome: "Spada Corta" }] },
        { etichetta: "Un'arma semplice", voci: [{ tipo: "armaAScelta", categoria: "semplice" }] },
      ],
      pacchetti("avventuriero", "esploratore"),
      fisso({ tipo: "arma", nome: "Dardo", qta: 10 }),
    ],
  },
  Paladino: {
    dadoVita: 10,
    tiriSalvezza: ["SAG", "CAR"],
    abilita: { numero: 2, lista: ["atletica", "intimidire", "intuizione", "medicina", "persuasione", "religione"] },
    armature: ["Tutte le armature", "Scudi"],
    armi: ["Armi semplici", "Armi da guerra"],
    strumenti: [],
    incantatore: {
      caratteristica: "CAR", tipo: "mezzo", modo: "preparati", trucchetti: perLivello([]), preparatiMetaLivello: true,
    },
    livelloSottoclasse: 3,
    sottoclassi: ["Giuramento di Devozione", "Giuramento degli Antichi", "Giuramento di Vendetta"],
    equipaggiamento: [
      [
        { etichetta: "Un'arma da guerra e uno scudo", voci: [{ tipo: "armaAScelta", categoria: "guerra" }, { tipo: "armatura", nome: "Scudo" }] },
        { etichetta: "Due armi da guerra", voci: [{ tipo: "armaAScelta", categoria: "guerra" }, { tipo: "armaAScelta", categoria: "guerra" }] },
      ],
      [
        { etichetta: "Cinque giavellotti", voci: [{ tipo: "arma", nome: "Giavellotto", qta: 5 }] },
        { etichetta: "Un'arma semplice da mischia", voci: [{ tipo: "armaAScelta", categoria: "semplice", soloMischia: true }] },
      ],
      pacchetti("sacerdote", "esploratore"),
      fisso({ tipo: "armatura", nome: "Cotta di Maglia" }, SIMBOLO_SACRO),
    ],
  },
  Ranger: {
    dadoVita: 10,
    tiriSalvezza: ["FOR", "DES"],
    abilita: {
      numero: 3,
      lista: ["addestrareAnimali", "atletica", "furtivita", "indagare", "intuizione", "natura", "percezione", "sopravvivenza"],
    },
    armature: ["Armature leggere", "Armature medie", "Scudi"],
    armi: ["Armi semplici", "Armi da guerra"],
    strumenti: [],
    incantatore: {
      caratteristica: "SAG", tipo: "mezzo", modo: "conosciuti", trucchetti: perLivello([]),
      conosciuti: [0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11],
    },
    livelloSottoclasse: 3,
    sottoclassi: ["Cacciatore", "Signore delle Bestie"],
    equipaggiamento: [
      [
        { etichetta: "Armatura di scaglie", voci: [{ tipo: "armatura", nome: "Armatura di Scaglie" }] },
        { etichetta: "Armatura di cuoio", voci: [{ tipo: "armatura", nome: "Armatura di Cuoio" }] },
      ],
      [
        { etichetta: "Due spade corte", voci: [{ tipo: "arma", nome: "Spada Corta", qta: 2 }] },
        {
          etichetta: "Due armi semplici da mischia",
          voci: [{ tipo: "armaAScelta", categoria: "semplice", soloMischia: true }, { tipo: "armaAScelta", categoria: "semplice", soloMischia: true }],
        },
      ],
      pacchetti("avventuriero", "esploratore"),
      fisso({ tipo: "arma", nome: "Arco Lungo" }, FRECCE),
    ],
  },
  Stregone: {
    dadoVita: 6,
    tiriSalvezza: ["COS", "CAR"],
    abilita: { numero: 2, lista: ["arcano", "inganno", "intimidire", "intuizione", "persuasione", "religione"] },
    armature: [],
    armi: ARMI_DA_INCANTATORE,
    strumenti: [],
    incantatore: {
      caratteristica: "CAR", tipo: "completo", modo: "conosciuti", trucchetti: perLivello([[1, 4], [4, 5], [10, 6]]),
      conosciuti: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15],
    },
    livelloSottoclasse: 1,
    sottoclassi: ["Discendenza Draconica", "Magia Selvaggia"],
    equipaggiamento: [
      [
        { etichetta: "Balestra leggera e 20 quadrelli", voci: [{ tipo: "arma", nome: "Balestra Leggera" }, QUADRELLI] },
        { etichetta: "Un'arma semplice", voci: [{ tipo: "armaAScelta", categoria: "semplice" }] },
      ],
      [
        { etichetta: "Borsa per componenti", voci: [BORSA_COMPONENTI] },
        { etichetta: "Focus arcano", voci: [FOCUS_ARCANO] },
      ],
      pacchetti("avventuriero", "esploratore"),
      fisso({ tipo: "arma", nome: "Pugnale", qta: 2 }),
    ],
  },
  Warlock: {
    dadoVita: 8,
    tiriSalvezza: ["SAG", "CAR"],
    abilita: { numero: 2, lista: ["arcano", "indagare", "inganno", "intimidire", "natura", "religione", "storia"] },
    armature: ["Armature leggere"],
    armi: ["Armi semplici"],
    strumenti: [],
    incantatore: {
      caratteristica: "CAR", tipo: "patto", modo: "conosciuti", trucchetti: TRUCCHETTI_2_3_4,
      conosciuti: [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15],
    },
    livelloSottoclasse: 1,
    sottoclassi: ["Il Signore Fatato", "L'Immondo", "Il Grande Antico"],
    equipaggiamento: [
      [
        { etichetta: "Balestra leggera e 20 quadrelli", voci: [{ tipo: "arma", nome: "Balestra Leggera" }, QUADRELLI] },
        { etichetta: "Un'arma semplice", voci: [{ tipo: "armaAScelta", categoria: "semplice" }] },
      ],
      [
        { etichetta: "Borsa per componenti", voci: [BORSA_COMPONENTI] },
        { etichetta: "Focus arcano", voci: [FOCUS_ARCANO] },
      ],
      pacchetti("studioso", "avventuriero"),
      fisso({ tipo: "armatura", nome: "Armatura di Cuoio" }, { tipo: "armaAScelta", categoria: "semplice" }, { tipo: "arma", nome: "Pugnale", qta: 2 }),
    ],
  },
};

export const NOMI_CLASSI = Object.keys(CLASSI) as NomeClasse[];

export const regoleClasse = (nome: string): RegoleClasse | undefined => CLASSI[nome as NomeClasse];

// Incantatore del personaggio: quello della classe, oppure quello della sottoclasse per i terzi incantatori.
export function incantatoreDi(classe: string, sottoclasse: string): Incantatore | null {
  const r = regoleClasse(classe);
  if (!r) return null;
  return r.incantatore ?? r.sottoclassiIncantatrici?.[sottoclasse] ?? null;
}

// Numero di incantesimi che la classe sceglie alla creazione (1° livello), oltre ai trucchetti.
// Il Mago ne copia 6 nel libro; chi prepara dall'intera lista non ne sceglie.
export function incantesimiIniziali(classe: string): number {
  const inc = regoleClasse(classe)?.incantatore;
  if (!inc) return 0;
  if (inc.modo === "libro") return 6;
  return inc.modo === "conosciuti" ? (inc.conosciuti?.[0] ?? 0) : 0;
}

// Caratteristica con cui si lanciano i trucchetti concessi dalla razza, per chi non ha una classe incantatrice.
export const CARATTERISTICA_MAGICA_RAZZIALE: Record<string, Caratteristica> = {
  "Alto Elfo": "INT",
  "Gnomo delle Foreste": "INT",
  "Elfo Oscuro (Drow)": "CAR",
  Tiefling: "CAR",
};

// Liste per le competenze a scelta.
export const LINGUE = [
  "Comune", "Draconico", "Elfico", "Gigante", "Gnomesco", "Goblin", "Halfling", "Infernale", "Nanico", "Orchesco",
  "Abissale", "Celestiale", "Gergo delle Profondità", "Primordiale", "Silvano", "Sottocomune",
];

export const STRUMENTI_ARTIGIANO = [
  "Scorte da alchimista", "Scorte da birraio", "Scorte da calligrafo", "Strumenti da calzolaio", "Strumenti da cartografo",
  "Strumenti da conciatore", "Strumenti da costruttore", "Strumenti da falegname", "Strumenti da fabbro",
  "Strumenti da gioielliere", "Strumenti da intagliatore", "Strumenti da inventore", "Strumenti da muratore",
  "Strumenti da pittore", "Strumenti da soffiatore", "Strumenti da tessitore", "Strumenti da vasaio", "Utensili da cuoco",
];

export const STRUMENTI_MUSICALI = [
  "Cornamusa", "Corno", "Dulcimer", "Flauto", "Flauto di Pan", "Lira", "Liuto", "Salterio", "Tamburo", "Viola",
];

export const GIOCHI = ["Dadi", "Mazzo di carte", "Scacchi dei draghi", "Gioco dei tre draghi"];
