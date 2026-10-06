import type { InventoryItem, Privilegio } from "../tipi.ts";

// Catalogo ufficiale dei background del Manuale del Giocatore 2014.
// Le descrizioni dei privilegi sono riassunti brevi, non il testo del manuale.

export type OggettoIniziale = Omit<InventoryItem, "id">;

export interface SemeBackground {
  nome: string;
  abilita: [string, string]; // id di ABILITA
  strumenti: string[];
  strumentiAScelta?: "artigiano" | "musicale" | "gioco"; // uno a scelta
  lingueAScelta: number;
  equipaggiamento: OggettoIniziale[];
  mo: number;
  privilegio: Privilegio;
}

const o = (nome: string, peso: number, qta = 1): OggettoIniziale => ({ nome, qta, peso });
const ABITI_COMUNI = o("Abiti comuni", 3);
const ABITI_VIAGGIO = o("Abiti da viaggiatore", 4);
const ABITI_PREGIATI = o("Abiti pregiati", 6);

export const BACKGROUND: SemeBackground[] = [
  {
    nome: "Accolito", abilita: ["intuizione", "religione"], strumenti: [], lingueAScelta: 2, mo: 15,
    equipaggiamento: [o("Simbolo sacro", 1), o("Libro di preghiere", 5), o("Bastoncini d'incenso", 0, 5), o("Paramenti", 4), ABITI_COMUNI],
    privilegio: { nome: "Riparo del Fedele", fonte: "Accolito", descrizione: "Lui e i compagni ricevono cure e ospitalità gratuite nei templi della sua fede, che lo sostengono anche con aiuti modesti." },
  },
  {
    nome: "Artigiano di Gilda", abilita: ["intuizione", "persuasione"], strumenti: [], strumentiAScelta: "artigiano", lingueAScelta: 1, mo: 15,
    equipaggiamento: [o("Strumenti da artigiano", 8), o("Lettera di presentazione della gilda", 0), ABITI_VIAGGIO],
    privilegio: { nome: "Membro di una Gilda", fonte: "Artigiano di Gilda", descrizione: "La gilda gli offre vitto e alloggio se serve, assistenza legale e contatti con persone influenti, in cambio di una quota mensile." },
  },
  {
    nome: "Ciarlatano", abilita: ["inganno", "rapiditaDiMano"], strumenti: ["Trucchi per il camuffamento", "Strumenti da falsario"], lingueAScelta: 0, mo: 15,
    equipaggiamento: [ABITI_PREGIATI, o("Trucchi per il camuffamento", 3), o("Attrezzi da truffatore", 1)],
    privilegio: { nome: "Falsa Identità", fonte: "Ciarlatano", descrizione: "Possiede una seconda identità con documenti, conoscenze e travestimenti, e sa falsificare documenti se ne ha visto un esempio." },
  },
  {
    nome: "Criminale", abilita: ["furtivita", "inganno"], strumenti: ["Arnesi da scasso"], strumentiAScelta: "gioco", lingueAScelta: 0, mo: 15,
    equipaggiamento: [o("Piede di porco", 5), o("Abiti comuni scuri con cappuccio", 3)],
    privilegio: { nome: "Contatto Criminale", fonte: "Criminale", descrizione: "Ha un contatto affidabile nel mondo criminale e sa come fargli arrivare messaggi anche a grande distanza." },
  },
  {
    nome: "Eremita", abilita: ["medicina", "religione"], strumenti: ["Borsa da erborista"], lingueAScelta: 1, mo: 5,
    equipaggiamento: [o("Custodia per pergamene con appunti", 1), o("Coperta invernale", 3), ABITI_COMUNI, o("Borsa da erborista", 3)],
    privilegio: { nome: "Scoperta", fonte: "Eremita", descrizione: "Nell'isolamento ha scoperto una verità unica e potente: un segreto cosmico, un luogo nascosto o un fatto che altri vorrebbero celare." },
  },
  {
    nome: "Eroe Popolare", abilita: ["addestrareAnimali", "sopravvivenza"], strumenti: ["Veicoli (terrestri)"], strumentiAScelta: "artigiano", lingueAScelta: 0, mo: 10,
    equipaggiamento: [o("Strumenti da artigiano", 8), o("Pala", 5), o("Pentola di ferro", 10), ABITI_COMUNI],
    privilegio: { nome: "Ospitalità Rustica", fonte: "Eroe Popolare", descrizione: "La gente comune lo accoglie e lo nasconde, purché non metta in pericolo nessuno." },
  },
  {
    nome: "Forestiero", abilita: ["atletica", "sopravvivenza"], strumenti: [], strumentiAScelta: "musicale", lingueAScelta: 1, mo: 10,
    equipaggiamento: [o("Bastone da viaggio", 4), o("Trappola da caccia", 25), o("Trofeo di un animale", 1), ABITI_VIAGGIO],
    privilegio: { nome: "Viandante", fonte: "Forestiero", descrizione: "Ricorda la geografia dei luoghi che attraversa e, se il terreno lo permette, trova cibo e acqua per sé e per altre cinque persone ogni giorno." },
  },
  {
    nome: "Intrattenitore", abilita: ["acrobazia", "intrattenere"], strumenti: ["Trucchi per il camuffamento"], strumentiAScelta: "musicale", lingueAScelta: 0, mo: 15,
    equipaggiamento: [o("Strumento musicale", 3), o("Pegno di un ammiratore", 0), o("Costume", 4)],
    privilegio: { nome: "A Grande Richiesta", fonte: "Intrattenitore", descrizione: "Trova sempre un posto dove esibirsi in cambio di vitto e alloggio modesti, e la sua fama gli apre qualche porta." },
  },
  {
    nome: "Marinaio", abilita: ["atletica", "percezione"], strumenti: ["Strumenti da navigatore", "Veicoli (acquatici)"], lingueAScelta: 0, mo: 10,
    equipaggiamento: [o("Caviglia di legno", 2), o("Corda di seta (15 m)", 5), o("Portafortuna", 0), ABITI_COMUNI],
    privilegio: { nome: "Passaggio su una Nave", fonte: "Marinaio", descrizione: "Ottiene un passaggio gratuito su una nave mercantile per sé e per i compagni, in cambio di aiuto a bordo." },
  },
  {
    nome: "Monello", abilita: ["furtivita", "rapiditaDiMano"], strumenti: ["Trucchi per il camuffamento", "Arnesi da scasso"], lingueAScelta: 0, mo: 10,
    equipaggiamento: [o("Coltellino", 0.5), o("Mappa della città natale", 0), o("Topolino domestico", 0), o("Ricordo dei genitori", 0), ABITI_COMUNI],
    privilegio: { nome: "Segreti della Città", fonte: "Monello", descrizione: "Conosce i passaggi segreti delle città: fuori dal combattimento lui e i compagni vi si spostano al doppio della velocità." },
  },
  {
    nome: "Nobile", abilita: ["persuasione", "storia"], strumenti: [], strumentiAScelta: "gioco", lingueAScelta: 1, mo: 25,
    equipaggiamento: [ABITI_PREGIATI, o("Anello con sigillo", 0), o("Pergamena di lignaggio", 0)],
    privilegio: { nome: "Posizione Privilegiata", fonte: "Nobile", descrizione: "È accolto nell'alta società, la gente comune lo tratta con riguardo e può ottenere udienza presso i nobili." },
  },
  {
    nome: "Sapiente", abilita: ["arcano", "storia"], strumenti: [], lingueAScelta: 2, mo: 10,
    equipaggiamento: [o("Boccetta d'inchiostro nero", 0), o("Pennino", 0), o("Coltellino", 0.5), o("Lettera di un collega", 0), ABITI_COMUNI],
    privilegio: { nome: "Ricercatore", fonte: "Sapiente", descrizione: "Quando non conosce un'informazione, spesso sa dove o da chi ottenerla." },
  },
  {
    nome: "Soldato", abilita: ["atletica", "intimidire"], strumenti: ["Veicoli (terrestri)"], strumentiAScelta: "gioco", lingueAScelta: 0, mo: 10,
    equipaggiamento: [o("Insegna del grado", 0), o("Trofeo di un nemico", 0), o("Dadi d'osso", 0), ABITI_COMUNI],
    privilegio: { nome: "Grado Militare", fonte: "Soldato", descrizione: "I soldati leali alla sua vecchia organizzazione ne riconoscono il grado e gli prestano mezzi e aiuto in modo temporaneo." },
  },
];
