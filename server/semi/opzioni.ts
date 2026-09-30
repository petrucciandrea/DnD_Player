import type { Privilegio } from "../../src/tipi.ts";
import { FONTE_METAMAGIA, FONTE_STILE, FONTE_TERRENO, STILI } from "../../src/dati/scelte.ts";
import { TERRENI } from "../../src/dati/incantesimiSottoclasse.ts";

// Opzioni delle scelte di privilegio (src/dati/scelte.ts): voci ufficiali del catalogo `privilegi` senza
// collegamento in `classe_privilegi`. Il personaggio le riceve come privilegi quando le sceglie.

const opzione = (fonte: string) => (nome: string, descrizione: string): Privilegio => ({ nome, fonte, descrizione });

const metamagia = opzione(FONTE_METAMAGIA);
const stile = opzione(FONTE_STILE);

export const METAMAGIE_CATALOGO: Privilegio[] = [
  metamagia("Incantesimo Accurato", "1 punto stregoneria. Quando lancia un incantesimo che richiede un TS, sceglie fino a mod CAR creature (minimo 1): superano automaticamente il TS."),
  metamagia("Incantesimo Distante", "1 punto stregoneria. Raddoppia la gittata di un incantesimo con gittata di almeno 1,5 m; a contatto diventa 9 m."),
  metamagia("Incantesimo Esteso", "1 punto stregoneria. Raddoppia la durata di un incantesimo di almeno 1 minuto, fino a un massimo di 24 ore."),
  metamagia("Incantesimo Gemello", "Punti stregoneria pari al livello dell'incantesimo (1 per un trucchetto). Un incantesimo che bersaglia una sola creatura, e non ha gittata personale, bersaglia una seconda creatura."),
  metamagia("Incantesimo Intensificato", "3 punti stregoneria. Un bersaglio dell'incantesimo ha svantaggio al primo tiro salvezza contro di esso."),
  metamagia("Incantesimo Potenziato", "1 punto stregoneria. Ritira fino a mod CAR dadi di danno (minimo 1) e usa i nuovi risultati. Si può combinare con un'altra Metamagia."),
  metamagia("Incantesimo Rapido", "2 punti stregoneria. Un incantesimo con tempo di lancio di 1 azione si lancia con 1 azione bonus."),
  metamagia("Incantesimo Sottile", "1 punto stregoneria. L'incantesimo si lancia senza componenti verbali né somatiche."),
];

export const STILI_CATALOGO: Privilegio[] = [
  stile(STILI.armiPossenti, "Con un'arma da mischia a due mani o versatile impugnata a due mani, può ritirare i dadi di danno che danno 1 o 2 (deve tenere il nuovo risultato)."),
  stile(STILI.dueArmi, "Combattendo con due armi aggiunge il modificatore di caratteristica ai danni del secondo attacco."),
  stile(STILI.difesa, "+1 alla CA quando indossa un'armatura."),
  stile(STILI.duellare, "+2 ai danni con un'arma da mischia impugnata in una mano, senza altre armi."),
  stile(STILI.protezione, "Con uno scudo, usa la reazione per imporre svantaggio all'attacco contro una creatura entro 1,5 m da lui."),
  stile(STILI.tiro, "+2 ai tiri per colpire con le armi a distanza."),
];

export const TERRENI_CATALOGO: Privilegio[] = Object.entries(TERRENI).map(([terreno, livelli]) => ({
  nome: terreno,
  fonte: FONTE_TERRENO,
  descrizione: `Incantesimi del circolo sempre preparati: ${livelli.map(([l, nomi]) => `${l}° livello ${nomi.join(", ")}`).join("; ")}.`,
}));

export const OPZIONI_PRIVILEGIO: Privilegio[] = [...METAMAGIE_CATALOGO, ...STILI_CATALOGO, ...TERRENI_CATALOGO];
