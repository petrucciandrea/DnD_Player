import type { Caratteristica, Privilegio } from "../tipi.ts";

// Catalogo ufficiale delle razze del Manuale del Giocatore 2014, con le sottorazze.
// Le descrizioni dei privilegi sono riassunti brevi, non il testo del manuale.
// Una sottorazza (con `madre`) si somma alla razza madre: bonus, competenze, lingue e privilegi.

export interface SemeRazza {
  nome: string;
  madre?: string;
  taglia?: "Piccola" | "Media";
  velocita?: string; // se manca vale quella della razza madre
  bonus: Partial<Record<Caratteristica, number>>;
  bonusAScelta?: number; // +1 ad altrettante caratteristiche a scelta (Mezzelfo)
  abilita?: string[]; // id di ABILITA
  abilitaAScelta?: number;
  lingue?: string[];
  lingueAScelta?: number;
  armi?: string[];
  armature?: string[];
  strumentiAScelta?: string[]; // uno a scelta tra questi
  trucchetto?: string; // trucchetto concesso dalla razza ("*" = uno a scelta dalla lista del mago)
  privilegi: Privilegio[];
}

const p = (nome: string, fonte: string, descrizione: string): Privilegio => ({ nome, fonte, descrizione });

const scurovisione = (fonte: string, metri = 18) =>
  p("Scurovisione", fonte, `Vede fino a ${metri} m in luce fioca come se fosse luce intensa, e nell'oscurità come se fosse luce fioca (solo in tonalità di grigio).`);

const ANTENATI: [string, string, string, string][] = [
  // colore, danno, area del soffio, TS
  ["Argento", "freddo", "cono di 4,5 m", "Costituzione"],
  ["Bianco", "freddo", "cono di 4,5 m", "Costituzione"],
  ["Blu", "fulmine", "linea di 1,5 × 9 m", "Destrezza"],
  ["Bronzo", "fulmine", "linea di 1,5 × 9 m", "Destrezza"],
  ["Nero", "acido", "linea di 1,5 × 9 m", "Destrezza"],
  ["Oro", "fuoco", "cono di 4,5 m", "Destrezza"],
  ["Ottone", "fuoco", "linea di 1,5 × 9 m", "Destrezza"],
  ["Rame", "acido", "linea di 1,5 × 9 m", "Destrezza"],
  ["Rosso", "fuoco", "cono di 4,5 m", "Destrezza"],
  ["Verde", "veleno", "cono di 4,5 m", "Costituzione"],
];

export const RAZZE: SemeRazza[] = [
  {
    nome: "Nano", taglia: "Media", velocita: "7,5 m", bonus: { COS: 2 }, lingue: ["Comune", "Nanico"],
    armi: ["Asce da battaglia", "Asce", "Martelli leggeri", "Martelli da guerra"],
    strumentiAScelta: ["Strumenti da fabbro", "Scorte da birraio", "Strumenti da muratore"],
    privilegi: [
      scurovisione("Nano"),
      p("Resilienza Nanica", "Nano", "Vantaggio ai tiri salvezza contro il veleno e resistenza ai danni da veleno."),
      p("Conoscenza della Pietra", "Nano", "Nelle prove di Intelligenza (Storia) sull'origine di opere in pietra è considerato competente e aggiunge il doppio del bonus di competenza."),
      p("Passo Robusto", "Nano", "La velocità non è ridotta dall'armatura pesante."),
    ],
  },
  {
    nome: "Nano delle Colline", madre: "Nano", bonus: { SAG: 1 },
    privilegi: [p("Robustezza Nanica", "Nano delle Colline", "I punti ferita massimi aumentano di 1, e di 1 in più a ogni livello.")],
  },
  {
    nome: "Nano delle Montagne", madre: "Nano", bonus: { FOR: 2 }, armature: ["Armature leggere", "Armature medie"],
    privilegi: [p("Addestramento nelle Armature Nanico", "Nano delle Montagne", "Competenza nelle armature leggere e medie.")],
  },
  {
    nome: "Elfo", taglia: "Media", velocita: "9 m", bonus: { DES: 2 }, abilita: ["percezione"], lingue: ["Comune", "Elfico"],
    privilegi: [
      scurovisione("Elfo"),
      p("Sensi Acuti", "Elfo", "Competenza nell'abilità Percezione."),
      p("Retaggio Fatato", "Elfo", "Vantaggio ai tiri salvezza per non essere affascinato; la magia non può farlo addormentare."),
      p("Trance", "Elfo", "Non dorme: medita in semi-coscienza per 4 ore al giorno e ottiene gli stessi benefici di 8 ore di sonno."),
    ],
  },
  {
    nome: "Alto Elfo", madre: "Elfo", bonus: { INT: 1 }, lingueAScelta: 1, trucchetto: "*",
    armi: ["Spade lunghe", "Spade corte", "Archi corti", "Archi lunghi"],
    privilegi: [
      p("Addestramento nelle Armi Elfico", "Alto Elfo", "Competenza in spada lunga, spada corta, arco corto e arco lungo."),
      p("Trucchetto", "Alto Elfo", "Conosce un trucchetto a scelta dalla lista del mago; lo lancia usando l'Intelligenza."),
    ],
  },
  {
    nome: "Elfo dei Boschi", madre: "Elfo", velocita: "10,5 m", bonus: { SAG: 1 },
    armi: ["Spade lunghe", "Spade corte", "Archi corti", "Archi lunghi"],
    privilegi: [
      p("Addestramento nelle Armi Elfico", "Elfo dei Boschi", "Competenza in spada lunga, spada corta, arco corto e arco lungo."),
      p("Piede Lesto", "Elfo dei Boschi", "La velocità base sale a 10,5 m."),
      p("Maschera della Natura", "Elfo dei Boschi", "Può tentare di nascondersi anche se è solo leggermente oscurato da fenomeni naturali (pioggia, nebbia, fogliame)."),
    ],
  },
  {
    nome: "Elfo Oscuro (Drow)", madre: "Elfo", bonus: { CAR: 1 }, trucchetto: "Luci Danzanti", armi: ["Stocchi", "Spade corte", "Balestre a mano"],
    privilegi: [
      p("Scurovisione Superiore", "Elfo Oscuro (Drow)", "La scurovisione arriva fino a 36 m."),
      p("Sensibilità alla Luce del Sole", "Elfo Oscuro (Drow)", "Svantaggio ai tiri per colpire e alle prove di Saggezza (Percezione) basate sulla vista quando lui, il bersaglio o ciò che osserva è in luce solare diretta."),
      p("Magia Drow", "Elfo Oscuro (Drow)", "Conosce il trucchetto luci danzanti; dal 3° livello lancia luminescenza e dal 5° oscurità, una volta ciascuno per riposo lungo. Usa il Carisma."),
      p("Addestramento nelle Armi Drow", "Elfo Oscuro (Drow)", "Competenza in stocchi, spade corte e balestre a mano."),
    ],
  },
  {
    nome: "Halfling", taglia: "Piccola", velocita: "7,5 m", bonus: { DES: 2 }, lingue: ["Comune", "Halfling"],
    privilegi: [
      p("Fortunato", "Halfling", "Quando ottiene 1 al d20 in un tiro per colpire, una prova o un tiro salvezza, può ritirare il dado e deve usare il nuovo risultato."),
      p("Coraggioso", "Halfling", "Vantaggio ai tiri salvezza per non essere spaventato."),
      p("Agilità Halfling", "Halfling", "Può muoversi attraverso lo spazio di qualsiasi creatura di taglia più grande della sua."),
    ],
  },
  {
    nome: "Halfling Piedelesto", madre: "Halfling", bonus: { CAR: 1 },
    privilegi: [p("Furtività Innata", "Halfling Piedelesto", "Può tentare di nascondersi anche quando è oscurato soltanto da una creatura di almeno una taglia più grande.")],
  },
  {
    nome: "Halfling Tozzo", madre: "Halfling", bonus: { COS: 1 },
    privilegi: [p("Resilienza dei Tozzi", "Halfling Tozzo", "Vantaggio ai tiri salvezza contro il veleno e resistenza ai danni da veleno.")],
  },
  {
    nome: "Umano", taglia: "Media", velocita: "9 m", bonus: { FOR: 1, DES: 1, COS: 1, INT: 1, SAG: 1, CAR: 1 },
    lingue: ["Comune"], lingueAScelta: 1, privilegi: [],
  },
  {
    nome: "Dragonide", taglia: "Media", velocita: "9 m", bonus: { FOR: 2, CAR: 1 }, lingue: ["Comune", "Draconico"],
    privilegi: [
      p("Arma a Soffio", "Dragonide", "Con un'azione esala energia distruttiva, determinata dall'antenato draconico. Le creature nell'area effettuano un tiro salvezza (CD 8 + mod COS + bonus di competenza): 2d6 danni, metà se lo superano. I danni salgono a 3d6 al 6°, 4d6 all'11° e 5d6 al 16° livello. Si usa una volta per riposo breve o lungo."),
    ],
  },
  ...ANTENATI.map(([colore, danno, area, ts]): SemeRazza => ({
    nome: `Dragonide (${colore})`, madre: "Dragonide", bonus: {},
    privilegi: [
      p("Antenato Draconico", `Dragonide (${colore})`, `Drago ${colore.toLowerCase()}: soffio di ${danno} (${area}, tiro salvezza su ${ts}) e resistenza ai danni da ${danno}.`),
    ],
  })),
  {
    nome: "Gnomo", taglia: "Piccola", velocita: "7,5 m", bonus: { INT: 2 }, lingue: ["Comune", "Gnomesco"],
    privilegi: [
      p("Scurovisione", "Gnomo", "Vede fino a 18 m in luce fioca come se fosse luce intensa, e nell'oscurità come se fosse luce fioca (solo in tonalità di grigio)."),
      p("Astuzia Gnomesca", "Gnomo", "Vantaggio a tutti i tiri salvezza di Intelligenza, Saggezza e Carisma contro la magia."),
    ],
  },
  {
    nome: "Gnomo delle Foreste", madre: "Gnomo", bonus: { DES: 1 }, trucchetto: "Illusione Minore",
    privilegi: [
      p("Illusionista Nato", "Gnomo delle Foreste", "Conosce il trucchetto illusione minore e lo lancia usando l'Intelligenza."),
      p("Parlare con le Piccole Bestie", "Gnomo delle Foreste", "Con suoni e gesti comunica idee semplici alle bestie Piccole o più piccole."),
    ],
  },
  {
    nome: "Gnomo delle Rocce", madre: "Gnomo", bonus: { COS: 1 },
    privilegi: [
      p("Conoscenze da Artefice", "Gnomo delle Rocce", "Nelle prove di Intelligenza (Storia) relative a oggetti magici, oggetti alchemici o congegni tecnologici aggiunge il doppio del bonus di competenza."),
      p("Armeggiare", "Gnomo delle Rocce", "Competenza negli strumenti da inventore. Con 1 ora e 10 mo di materiali costruisce un congegno a orologeria Minuscolo (CA 5, 1 PF): giocattolo, accendino o carillon. Massimo 3 attivi, ognuno funziona per 24 ore."),
    ],
  },
  {
    nome: "Mezzelfo", taglia: "Media", velocita: "9 m", bonus: { CAR: 2 }, bonusAScelta: 2, abilitaAScelta: 2,
    lingue: ["Comune", "Elfico"], lingueAScelta: 1,
    privilegi: [
      scurovisione("Mezzelfo"),
      p("Retaggio Fatato", "Mezzelfo", "Vantaggio ai tiri salvezza per non essere affascinato; la magia non può farlo addormentare."),
      p("Versatilità nelle Abilità", "Mezzelfo", "Competenza in due abilità a scelta."),
    ],
  },
  {
    nome: "Mezzorco", taglia: "Media", velocita: "9 m", bonus: { FOR: 2, COS: 1 }, abilita: ["intimidire"], lingue: ["Comune", "Orchesco"],
    privilegi: [
      scurovisione("Mezzorco"),
      p("Minaccioso", "Mezzorco", "Competenza nell'abilità Intimidire."),
      p("Tenacia Implacabile", "Mezzorco", "Quando scende a 0 punti ferita senza morire sul colpo, può restare invece a 1 PF. Una volta per riposo lungo."),
      p("Attacchi Selvaggi", "Mezzorco", "Con un colpo critico in mischia tira un dado di danno dell'arma in più."),
    ],
  },
  {
    nome: "Tiefling", taglia: "Media", velocita: "9 m", bonus: { CAR: 2, INT: 1 }, lingue: ["Comune", "Infernale"], trucchetto: "Taumaturgia",
    privilegi: [
      scurovisione("Tiefling"),
      p("Resistenza Infernale", "Tiefling", "Resistenza ai danni da fuoco."),
      p("Retaggio Infernale", "Tiefling", "Conosce il trucchetto taumaturgia; dal 3° livello lancia rimprovero infernale (come incantesimo di 2° livello) e dal 5° oscurità, una volta ciascuno per riposo lungo. Usa il Carisma."),
    ],
  },
];

