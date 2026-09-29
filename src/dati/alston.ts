import type { CharacterData } from "../tipi";

// DATI INIZIALI UFFICIALI DI ALSTON IL BREVE
export const INITIAL_CHARACTER: CharacterData = {
  versione: 2,
  info: {
    nome: "Alston il Breve",
    classe: "Mago",
    sottoclasse: "Scuola di Divinazione",
    livello: 3,
    razza: "Gnomo delle Rocce",
    background: "Sapiente",
    allineamento: "Neutrale Buono",
    giocatore: "Andrea",
    eta: 378,
    altezza: "95 cm",
    peso: "25.5 kg",
    occhi: "Verdi",
    capelli: "Bianchi",
    carnagione: "Chiara",
    velocita: "7.5 m",
    taglia: "Piccola",
    ispirazione: true
  },
  caratteristiche: {
    FOR: { valore: 8, compTS: false },
    DES: { valore: 13, compTS: false },
    COS: { valore: 16, compTS: false },
    INT: { valore: 17, compTS: true },
    SAG: { valore: 13, compTS: true },
    CAR: { valore: 10, compTS: false }
  },
  // Sapiente: Arcano, Storia. Mago: Religione, Intuizione.
  competenzeAbilita: ["arcano", "storia", "religione", "intuizione"],
  competenzeAltre: {
    lingue: ["Comune", "Gnomesco"],
    strumenti: ["Strumenti da inventore"],
    armi: ["Balestre leggere", "Bastoni ferrati", "Dardi", "Fionde", "Pugnali"],
    armature: [],
  },
  armatura: null,
  scudo: false,
  combattimento: {
    pfAttuali: 23,
    pfMassimi: 23,
    pfTemporanei: 0,
    dadiVitaRimanenti: 3,
    tsMorte: { successi: 0, fallimenti: 0 },
    stabile: false
  },
  concentrazione: null,
  divinazione: {
    presagio: [4, 16],
    usati: [false, false]
  },
  recuperoArcanoUsato: false,
  monete: {
    mr: 228,
    ma: 557,
    me: 0,
    mo: 497,
    mp: 0
  },
  xp: {
    totale: 2230,
    storico: [
      { id: 1, data: "Sessione Iniziale", valore: 2230, motivo: "Avanzamento a Mago di 3° Livello" }
    ]
  },
  armi: [
    { nome: "Bastone Ferrato", dado: "1d6", dadoVersatile: "1d8", tipoDanno: "Contundente", proprieta: "Versatile", accurata: false, categoria: "semplice" },
    { nome: "Pugnale", dado: "1d4", tipoDanno: "Perforante", proprieta: "Accurata, Leggera, Lancio (6/18 m)", accurata: true, categoria: "semplice" }
  ],
  slotSpesi: [0, 0, 0, 0, 0, 0, 0, 0, 0],
  incantesimi: [
    { id: 1, nome: "Dardo di Fuoco", livello: 0, scuola: "Invocazione", tempo: "1 Azione", preparato: true },
    { id: 2, nome: "Interdizione alle Lame", livello: 0, scuola: "Abiurazione", tempo: "1 Azione", preparato: true },
    { id: 3, nome: "Tocco Gelido", livello: 0, scuola: "Necromanzia", tempo: "1 Azione", preparato: true },
    { id: 4, nome: "Charm su Persone", livello: 1, scuola: "Ammaliamento", tempo: "1 Azione", preparato: false },
    { id: 5, nome: "Dardo Incantato", livello: 1, scuola: "Invocazione", tempo: "1 Azione", preparato: true },
    { id: 6, nome: "Individuazione del Magico", livello: 1, scuola: "Divinazione (Rituale)", tempo: "1 Azione o Rituale", preparato: false },
    { id: 7, nome: "Mani Brucianti", livello: 1, scuola: "Invocazione", tempo: "1 Azione", preparato: true },
    { id: 8, nome: "Onda Tuonante", livello: 1, scuola: "Invocazione", tempo: "1 Azione", preparato: false },
    { id: 9, nome: "Raggio di Infermità", livello: 1, scuola: "Necromanzia", tempo: "1 Azione", preparato: false },
    { id: 10, nome: "Risata Incontenibile di Tasha", livello: 1, scuola: "Ammaliamento", tempo: "1 Azione", preparato: true },
    { id: 11, nome: "Ritirata Rapida", livello: 1, scuola: "Trasmutazione", tempo: "1 Azione Bonus", preparato: false },
    { id: 12, nome: "Scudo", livello: 1, scuola: "Abiurazione", tempo: "1 Reazione", preparato: true },
    { id: 13, nome: "Blocca Persone", livello: 2, scuola: "Ammaliamento", tempo: "1 Azione", preparato: false },
    { id: 14, nome: "Immagine Speculare", livello: 2, scuola: "Illusione", tempo: "1 Azione", preparato: true },
    { id: 15, nome: "Raggio Rovente", livello: 2, scuola: "Invocazione", tempo: "1 Azione", preparato: true }
  ],
  inventario: [
    { id: 1, nome: "Libro degli Incantesimi", qta: 1, peso: 3 },
    { id: 2, nome: "Focus Arcano", qta: 1, peso: 1 },
    { id: 3, nome: "Liuto (35 mo)", qta: 1, peso: 2 },
    { id: 4, nome: "Bussola (25 mo)", qta: 1, peso: 0.5 },
    { id: 5, nome: "Strumenti da Cartografo & Mappe", qta: 1, peso: 6 },
    { id: 6, nome: "Strumenti da Inventore", qta: 1, peso: 10 },
    { id: 7, nome: "Calamaio d'inchiostro nero, pennino, pergamene", qta: 1, peso: 1 },
    { id: 8, nome: "Lettere di colleghi e appunti accademici", qta: 1, peso: 0.5 },
    { id: 9, nome: "Pietra Turchese (10 mo)", qta: 1, peso: 0.1 },
    { id: 10, nome: "Gemme Occhio di Tigre (10 mo cad.)", qta: 2, peso: 0.2 },
    { id: 11, nome: "Diaspro Sanguigno", qta: 1, peso: 0.1 },
    { id: 12, nome: "Diaspri Blu", qta: 5, peso: 0.5 },
    { id: 13, nome: "Cristalli di Quarzo Celeste (10 mo cad.)", qta: 5, peso: 0.5 },
    { id: 14, nome: "Orecchino (25 mo) e Bracciale (25 mo)", qta: 1, peso: 0.2 },
    { id: 15, nome: "Chiave dell'Osservatorio & Chiave del Tunnel", qta: 2, peso: 0.2 },
    { id: 16, nome: "Dotazione da Esploratore (Zaino, Giaciglio, Torce, Razioni, Otre, Corda 15m)", qta: 1, peso: 45 }
  ],
  privilegi: [
    { nome: "Scurovisione", fonte: "Gnomo", descrizione: "Vede fino a 18 m in luce fioca come se fosse luce intensa, e nell'oscurità come se fosse luce fioca (solo in tonalità di grigio)." },
    { nome: "Astuzia Gnomesca", fonte: "Gnomo", descrizione: "Vantaggio a tutti i tiri salvezza di Intelligenza, Saggezza e Carisma contro la magia." },
    { nome: "Conoscenze da Artefice", fonte: "Gnomo delle Rocce", descrizione: "Nelle prove di Intelligenza (Storia) relative a oggetti magici, oggetti alchemici o congegni tecnologici aggiunge il doppio del bonus di competenza." },
    { nome: "Armeggiare", fonte: "Gnomo delle Rocce", descrizione: "Competenza negli strumenti da inventore. Con 1 ora e 10 mo di materiali costruisce un congegno a orologeria Minuscolo (CA 5, 1 PF): giocattolo, accendino o carillon. Massimo 3 attivi, ognuno funziona per 24 ore." },
    { nome: "Ricercatore", fonte: "Sapiente", descrizione: "Quando non conosce un'informazione, spesso sa dove o da chi ottenerla." },
    { nome: "Incantesimi Rituali", fonte: "Mago", descrizione: "Può lanciare come rituale qualsiasi incantesimo rituale presente nel libro degli incantesimi, anche se non è preparato." },
    { nome: "Recupero Arcano", fonte: "Mago", descrizione: "Una volta al giorno, durante un riposo breve, recupera slot incantesimo di livello complessivo pari alla metà del livello da mago (per eccesso). Nessuno slot di 6° livello o superiore." },
    { nome: "Esperto di Divinazione", fonte: "Scuola di Divinazione", descrizione: "Oro e tempo necessari per copiare un incantesimo di divinazione nel libro sono dimezzati." },
    { nome: "Presagio", fonte: "Scuola di Divinazione", descrizione: "Dopo un riposo lungo tira 2d20 (3d20 dal 14° livello). Può sostituire un tiro per colpire, un tiro salvezza o una prova, propri o di una creatura visibile, con uno di questi risultati. Ognuno si usa una sola volta." }
  ],
  lore: {
    tratti: "Il sapiente è disposto ad aiutare quelli meno intelligenti di lui, spiegando ogni cosa con infinita pazienza.",
    ideali: "Miglioramento: l'obiettivo di una vita di studio è il perfezionamento personale.",
    legami: "Il sapiente ha dedicato tutta la sua vita al completamento di una serie di volumi su un campo specifico del sapere.",
    difetti: "La maggior parte delle persone urla e fugge davanti al terrore; Alston invece si ferma e prende appunti sull'anatomia del mostro.",
    backgroundBio: "Nato 378 anni fa in un'enclave di gnomi delle rocce, Alston è affascinato dai meccanismi e dalla magia. Durante una spedizione nell'Underdark entrò in comunione con una colonia di miconidi tramite spore prima che venisse sterminata. Da allora viaggia per ricostruire quella primordiale rete di coscienze fungine."
  }
};
