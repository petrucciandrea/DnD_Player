import type { Privilegio } from "../../src/tipi.ts";
import type { NomeClasse } from "../../src/dati/classi.ts";

// Privilegi di classe e di sottoclasse per livello (tabella `classe_privilegi`).
// Per ora ci sono il 1° livello di ogni classe, le sottoclassi scelte al 1° e ciò che serve ad Alston.
// Le descrizioni sono riassunti brevi, non il testo del manuale.

export interface SemePrivilegioClasse {
  classe: NomeClasse;
  sottoclasse?: string;
  livello: number;
  privilegio: Privilegio;
}

const c = (classe: NomeClasse, livello: number, nome: string, descrizione: string): SemePrivilegioClasse =>
  ({ classe, livello, privilegio: { nome, fonte: classe, descrizione } });

const s = (classe: NomeClasse, sottoclasse: string, livello: number, nome: string, descrizione: string): SemePrivilegioClasse =>
  ({ classe, sottoclasse, livello, privilegio: { nome, fonte: sottoclasse, descrizione } });

export const PRIVILEGI_CLASSE: SemePrivilegioClasse[] = [
  c("Barbaro", 1, "Ira", "Con un'azione bonus entra in ira per 1 minuto: vantaggio alle prove e ai TS di Forza, bonus ai danni in mischia con la Forza (+2 al 1°) e resistenza ai danni contundenti, perforanti e taglienti. Non può lanciare incantesimi. 2 volte per riposo lungo al 1° livello."),
  c("Barbaro", 1, "Difesa Senza Armatura (Barbaro)", "Senza armatura la CA è 10 + mod DES + mod COS; può comunque usare uno scudo."),

  c("Bardo", 1, "Ispirazione Bardica", "Con un'azione bonus dà a una creatura entro 18 m un dado d'ispirazione (d6 al 1°) da aggiungere a una prova, un tiro per colpire o un tiro salvezza nei 10 minuti successivi. Usi pari al mod CAR (minimo 1) per riposo lungo."),
  c("Bardo", 1, "Incantesimi (Bardo)", "Lancia incantesimi da bardo usando il Carisma; conosce un numero fisso di incantesimi e può usare uno strumento musicale come focus."),

  c("Chierico", 1, "Incantesimi (Chierico)", "Lancia incantesimi da chierico usando la Saggezza; ogni giorno prepara livello + mod SAG incantesimi dall'intera lista. Usa un simbolo sacro come focus."),
  c("Chierico", 1, "Dominio Divino", "Sceglie un dominio legato alla sua divinità, che gli concede incantesimi di dominio sempre preparati e privilegi al 1°, 2°, 6°, 8° e 17° livello."),
  s("Chierico", "Dominio della Conoscenza", 1, "Benedizioni della Conoscenza", "Due lingue in più e competenza (con bonus raddoppiato) in due abilità tra Arcano, Natura, Religione e Storia."),
  s("Chierico", "Dominio della Guerra", 1, "Sacerdote Guerriero", "Competenza nelle armi da guerra e nelle armature pesanti. Quando attacca, può effettuare un attacco con un'arma come azione bonus (usi pari al mod SAG per riposo lungo)."),
  s("Chierico", "Dominio dell'Inganno", 1, "Benedizione dell'Imbroglione", "Con un'azione dà a un'altra creatura vantaggio alle prove di Destrezza (Furtività) per 1 ora."),
  s("Chierico", "Dominio della Luce", 1, "Bagliore Protettivo", "Conosce il trucchetto luce. Con una reazione impone svantaggio a un attacco contro di sé da una creatura entro 9 m (usi pari al mod SAG per riposo lungo)."),
  s("Chierico", "Dominio della Natura", 1, "Accolito della Natura", "Un trucchetto da druido, competenza in un'abilità tra Addestrare Animali, Natura e Sopravvivenza, e nelle armature pesanti."),
  s("Chierico", "Dominio della Tempesta", 1, "Ira della Tempesta", "Competenza nelle armi da guerra e nelle armature pesanti. Con una reazione infligge 2d8 danni da fulmine o tuono a chi lo colpisce in mischia (TS DES per dimezzare)."),
  s("Chierico", "Dominio della Vita", 1, "Discepolo della Vita", "Competenza nelle armature pesanti. Gli incantesimi di cura di 1° livello o superiore curano 2 + livello dell'incantesimo PF in più."),

  c("Druido", 1, "Druidico", "Conosce il druidico, la lingua segreta dei druidi, e sa lasciare messaggi nascosti."),
  c("Druido", 1, "Incantesimi (Druido)", "Lancia incantesimi da druido usando la Saggezza; ogni giorno prepara livello + mod SAG incantesimi dall'intera lista. Usa un focus druidico."),

  c("Guerriero", 1, "Stile di Combattimento", "Sceglie uno stile tra Arma a Due Mani, Combattere con Due Armi, Difesa, Duellare, Protezione e Tiro, che gli dà un beneficio permanente."),
  c("Guerriero", 1, "Recuperare Energie", "Con un'azione bonus recupera 1d10 + livello da guerriero PF. Una volta per riposo breve o lungo."),

  c("Ladro", 1, "Maestria", "Sceglie due competenze (abilità o arnesi da scasso): il bonus di competenza raddoppia."),
  c("Ladro", 1, "Attacco Furtivo", "Una volta per turno infligge 1d6 danni extra (al 1°) a chi colpisce con un'arma accurata o a distanza, se ha vantaggio o se un alleato è entro 1,5 m dal bersaglio."),
  c("Ladro", 1, "Gergo Ladresco", "Conosce il gergo segreto dei ladri, fatto di espressioni e simboli nascosti."),

  c("Mago", 1, "Incantesimi Rituali", "Può lanciare come rituale qualsiasi incantesimo rituale presente nel libro degli incantesimi, anche se non è preparato."),
  c("Mago", 1, "Recupero Arcano", "Una volta al giorno, durante un riposo breve, recupera slot incantesimo di livello complessivo pari alla metà del livello da mago (per eccesso). Nessuno slot di 6° livello o superiore."),
  s("Mago", "Scuola di Divinazione", 2, "Esperto di Divinazione", "Oro e tempo necessari per copiare un incantesimo di divinazione nel libro sono dimezzati."),
  s("Mago", "Scuola di Divinazione", 2, "Presagio", "Dopo un riposo lungo tira 2d20 (3d20 dal 14° livello). Può sostituire un tiro per colpire, un tiro salvezza o una prova, propri o di una creatura visibile, con uno di questi risultati. Ognuno si usa una sola volta."),

  c("Monaco", 1, "Difesa Senza Armatura (Monaco)", "Senza armatura e senza scudo la CA è 10 + mod DES + mod SAG."),
  c("Monaco", 1, "Arti Marziali", "Senza armatura né scudo, con i colpi senz'armi e le armi da monaco può usare la DES al posto della FOR, tira 1d4 per i danni (al 1°) e può fare un colpo senz'armi come azione bonus dopo aver attaccato."),

  c("Paladino", 1, "Percezione del Divino", "Con un'azione percepisce celestiali, immondi e non morti entro 18 m non coperti del tutto. Usi pari a 1 + mod CAR per riposo lungo."),
  c("Paladino", 1, "Imposizione delle Mani", "Ha una riserva di PF pari a 5 × livello da paladino: con un'azione li distribuisce toccando le creature, o ne spende 5 per curare una malattia o un veleno. Si ricarica con il riposo lungo."),

  c("Ranger", 1, "Nemico Prescelto", "Sceglie un tipo di nemico: vantaggio alle prove per seguirne le tracce e per ricordare informazioni su di esso, e ne impara una lingua."),
  c("Ranger", 1, "Esploratore Nato", "Sceglie un terreno prediletto: lì viaggia più veloce, non si perde, resta vigile e trova più cibo e tracce."),

  c("Stregone", 1, "Incantesimi (Stregone)", "Lancia incantesimi da stregone usando il Carisma; conosce un numero fisso di incantesimi e può usare un focus arcano."),
  c("Stregone", 1, "Origine Stregonesca", "La sua magia innata ha un'origine che gli concede privilegi al 1°, 6°, 14° e 18° livello."),
  s("Stregone", "Discendenza Draconica", 1, "Antenato del Drago", "Sceglie un tipo di drago: parla il draconico e raddoppia il bonus di competenza nelle prove di Carisma con i draghi."),
  s("Stregone", "Discendenza Draconica", 1, "Resilienza Draconica", "I PF massimi aumentano di 1 e di 1 in più a ogni livello da stregone. Senza armatura la CA è 13 + mod DES."),
  s("Stregone", "Magia Selvaggia", 1, "Impulso di Magia Selvaggia", "Dopo aver lanciato un incantesimo di 1° livello o superiore, su richiesta del DM tira un d20: con 1 si scatena un effetto casuale della tabella della magia selvaggia."),
  s("Stregone", "Magia Selvaggia", 1, "Maree del Caos", "Una volta per riposo lungo ottiene vantaggio a un tiro per colpire, una prova o un tiro salvezza."),

  c("Warlock", 1, "Patrono Ultraterreno", "Ha stretto un patto con un essere ultraterreno che gli concede privilegi al 1°, 6°, 10° e 14° livello."),
  c("Warlock", 1, "Magia del Patto", "Lancia incantesimi da warlock usando il Carisma. Ha pochi slot, tutti dello stesso livello, che recupera con un riposo breve o lungo."),
  s("Warlock", "Il Signore Fatato", 1, "Presenza Fatata", "Con un'azione le creature in un cubo di 3 m devono superare un TS su Saggezza o restare affascinate o spaventate fino alla fine del suo turno successivo. Una volta per riposo breve o lungo."),
  s("Warlock", "L'Immondo", 1, "Benedizione dell'Oscuro", "Quando riduce a 0 PF una creatura ostile, ottiene PF temporanei pari a mod CAR + livello da warlock (minimo 1)."),
  s("Warlock", "Il Grande Antico", 1, "Mente Risvegliata", "Comunica telepaticamente con qualsiasi creatura entro 9 m che capisca almeno una lingua."),
];
