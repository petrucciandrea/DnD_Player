import type { Privilegio } from "../../src/tipi.ts";

// Catalogo ufficiale dei privilegi di razza, classe, sottoclasse e background (creato_da NULL).
// Una voce è identificata da nome + fonte: lo stesso nome può avere effetti diversi (es. Scurovisione).
export const PRIVILEGI: Privilegio[] = [
  { nome: "Scurovisione", fonte: "Gnomo", descrizione: "Vede fino a 18 m in luce fioca come se fosse luce intensa, e nell'oscurità come se fosse luce fioca (solo in tonalità di grigio)." },
  { nome: "Astuzia Gnomesca", fonte: "Gnomo", descrizione: "Vantaggio a tutti i tiri salvezza di Intelligenza, Saggezza e Carisma contro la magia." },
  { nome: "Conoscenze da Artefice", fonte: "Gnomo delle Rocce", descrizione: "Nelle prove di Intelligenza (Storia) relative a oggetti magici, oggetti alchemici o congegni tecnologici aggiunge il doppio del bonus di competenza." },
  { nome: "Armeggiare", fonte: "Gnomo delle Rocce", descrizione: "Competenza negli strumenti da inventore. Con 1 ora e 10 mo di materiali costruisce un congegno a orologeria Minuscolo (CA 5, 1 PF): giocattolo, accendino o carillon. Massimo 3 attivi, ognuno funziona per 24 ore." },
  { nome: "Ricercatore", fonte: "Sapiente", descrizione: "Quando non conosce un'informazione, spesso sa dove o da chi ottenerla." },
  { nome: "Incantesimi Rituali", fonte: "Mago", descrizione: "Può lanciare come rituale qualsiasi incantesimo rituale presente nel libro degli incantesimi, anche se non è preparato." },
  { nome: "Recupero Arcano", fonte: "Mago", descrizione: "Una volta al giorno, durante un riposo breve, recupera slot incantesimo di livello complessivo pari alla metà del livello da mago (per eccesso). Nessuno slot di 6° livello o superiore." },
  { nome: "Esperto di Divinazione", fonte: "Scuola di Divinazione", descrizione: "Oro e tempo necessari per copiare un incantesimo di divinazione nel libro sono dimezzati." },
  { nome: "Presagio", fonte: "Scuola di Divinazione", descrizione: "Dopo un riposo lungo tira 2d20 (3d20 dal 14° livello). Può sostituire un tiro per colpire, un tiro salvezza o una prova, propri o di una creatura visibile, con uno di questi risultati. Ognuno si usa una sola volta." },
];
