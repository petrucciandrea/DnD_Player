import { copyFileSync, existsSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";
import { daJSON } from "@dnd/regole/scheda.ts";
import { aggiornaCataloghi } from "./catalogo.ts";
import { creaPersonaggio } from "./personaggi.ts";
import { transazione } from "./transazione.ts";

// Versione dello schema, salvata in PRAGMA user_version.
// 1 (implicita, user_version 0): una riga JSON per personaggio, utenti con un solo personaggio.
// 2: dati del personaggio in tabelle, cataloghi condivisi, più personaggi per utente.
// 3: armature, razze, background, privilegi di classe, classi degli incantesimi; taglia, armatura e
//    competenze (lingue, strumenti, armi, armature) del personaggio.
// 4: risorse di classe usate, condizioni, indebolimento, effetti attivi e note di sessione del personaggio.
// 5: avatar; armi del personaggio con bonus, munizioni, durabilità e stato (anche due armi uguali); campi delle note.
export const VERSIONE_SCHEMA = 5;

// Esportato per i test della migrazione.
export const SCHEMA_V2 = `
  CREATE TABLE utenti (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    hash TEXT NOT NULL,
    creato TEXT NOT NULL
  );
  CREATE TABLE sessioni (
    token TEXT PRIMARY KEY,
    utente_id INTEGER NOT NULL REFERENCES utenti(id) ON DELETE CASCADE,
    scadenza INTEGER NOT NULL
  );

  -- Cataloghi condivisi. creato_da NULL = voce ufficiale (seed), altrimenti l'utente che l'ha aggiunta.
  CREATE TABLE incantesimi (
    id INTEGER PRIMARY KEY,
    nome TEXT NOT NULL UNIQUE COLLATE NOCASE,
    livello INTEGER NOT NULL,
    scuola TEXT NOT NULL,
    tempo TEXT NOT NULL,
    gittata TEXT,
    componenti TEXT,
    durata TEXT,
    concentrazione INTEGER NOT NULL DEFAULT 0,
    rituale INTEGER NOT NULL DEFAULT 0,
    descrizione TEXT,                  -- NULL: voce senza dettagli (si può solo spendere lo slot)
    livello_superiore TEXT,
    attacco_numero INTEGER,
    attacco_per_livello INTEGER,
    ts_caratteristica TEXT,
    ts_effetto TEXT,
    danni_dado TEXT,
    danni_tipo TEXT,
    danni_mod INTEGER,
    danni_per_livello TEXT,
    danni_mod_per_livello INTEGER,
    danni_trucchetto INTEGER,
    danni_per_attacco INTEGER,
    creato_da INTEGER REFERENCES utenti(id)
  );
  CREATE TABLE armi (
    id INTEGER PRIMARY KEY,
    nome TEXT NOT NULL UNIQUE COLLATE NOCASE,
    dado TEXT NOT NULL,
    dado_versatile TEXT,
    tipo_danno TEXT NOT NULL,
    proprieta TEXT NOT NULL,
    accurata INTEGER NOT NULL,
    creato_da INTEGER REFERENCES utenti(id)
  );
  CREATE TABLE privilegi (
    id INTEGER PRIMARY KEY,
    nome TEXT NOT NULL COLLATE NOCASE,
    fonte TEXT NOT NULL COLLATE NOCASE,
    descrizione TEXT NOT NULL,
    creato_da INTEGER REFERENCES utenti(id),
    UNIQUE (nome, fonte)
  );

  CREATE TABLE personaggi (
    id INTEGER PRIMARY KEY,
    utente_id INTEGER NOT NULL REFERENCES utenti(id) ON DELETE CASCADE,
    revisione INTEGER NOT NULL,
    aggiornato TEXT NOT NULL,
    nome TEXT NOT NULL DEFAULT '',
    classe TEXT NOT NULL DEFAULT '',
    sottoclasse TEXT NOT NULL DEFAULT '',
    livello INTEGER NOT NULL DEFAULT 1,
    razza TEXT NOT NULL DEFAULT '',
    background TEXT NOT NULL DEFAULT '',
    allineamento TEXT NOT NULL DEFAULT '',
    giocatore TEXT NOT NULL DEFAULT '',
    eta INTEGER NOT NULL DEFAULT 0,
    altezza TEXT NOT NULL DEFAULT '',
    peso TEXT NOT NULL DEFAULT '',
    occhi TEXT NOT NULL DEFAULT '',
    capelli TEXT NOT NULL DEFAULT '',
    carnagione TEXT NOT NULL DEFAULT '',
    velocita TEXT NOT NULL DEFAULT '',
    ispirazione INTEGER NOT NULL DEFAULT 0,
    pf_attuali INTEGER NOT NULL DEFAULT 0,
    pf_massimi INTEGER NOT NULL DEFAULT 0,
    pf_temporanei INTEGER NOT NULL DEFAULT 0,
    dadi_vita_rimanenti INTEGER NOT NULL DEFAULT 0,
    ts_morte_successi INTEGER NOT NULL DEFAULT 0,
    ts_morte_fallimenti INTEGER NOT NULL DEFAULT 0,
    stabile INTEGER NOT NULL DEFAULT 0,
    concentrazione_id INTEGER REFERENCES incantesimi(id),
    recupero_arcano_usato INTEGER NOT NULL DEFAULT 0,
    mr INTEGER NOT NULL DEFAULT 0,
    ma INTEGER NOT NULL DEFAULT 0,
    me INTEGER NOT NULL DEFAULT 0,
    mo INTEGER NOT NULL DEFAULT 0,
    mp INTEGER NOT NULL DEFAULT 0,
    xp_totale INTEGER NOT NULL DEFAULT 0,
    tratti TEXT NOT NULL DEFAULT '',
    ideali TEXT NOT NULL DEFAULT '',
    legami TEXT NOT NULL DEFAULT '',
    difetti TEXT NOT NULL DEFAULT '',
    background_bio TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX personaggi_utente ON personaggi(utente_id);

  CREATE TABLE personaggio_caratteristiche (
    personaggio_id INTEGER NOT NULL REFERENCES personaggi(id) ON DELETE CASCADE,
    car TEXT NOT NULL,
    valore INTEGER NOT NULL,
    comp_ts INTEGER NOT NULL,
    PRIMARY KEY (personaggio_id, car)
  );
  CREATE TABLE personaggio_abilita (
    personaggio_id INTEGER NOT NULL REFERENCES personaggi(id) ON DELETE CASCADE,
    abilita TEXT NOT NULL,
    PRIMARY KEY (personaggio_id, abilita)
  );
  CREATE TABLE personaggio_slot (
    personaggio_id INTEGER NOT NULL REFERENCES personaggi(id) ON DELETE CASCADE,
    livello INTEGER NOT NULL CHECK (livello BETWEEN 1 AND 9),
    spesi INTEGER NOT NULL,
    PRIMARY KEY (personaggio_id, livello)
  );
  CREATE TABLE personaggio_presagio (
    personaggio_id INTEGER NOT NULL REFERENCES personaggi(id) ON DELETE CASCADE,
    indice INTEGER NOT NULL,
    valore INTEGER NOT NULL,
    usato INTEGER NOT NULL,
    PRIMARY KEY (personaggio_id, indice)
  );
  CREATE TABLE personaggio_xp (
    personaggio_id INTEGER NOT NULL REFERENCES personaggi(id) ON DELETE CASCADE,
    ordine INTEGER NOT NULL,
    id_locale INTEGER NOT NULL,
    data TEXT NOT NULL,
    valore INTEGER NOT NULL,
    motivo TEXT NOT NULL,
    PRIMARY KEY (personaggio_id, ordine)
  );
  CREATE TABLE personaggio_oggetti (
    personaggio_id INTEGER NOT NULL REFERENCES personaggi(id) ON DELETE CASCADE,
    ordine INTEGER NOT NULL,
    id_locale INTEGER NOT NULL,
    nome TEXT NOT NULL,
    qta INTEGER NOT NULL,
    peso REAL NOT NULL, -- lb per unità
    PRIMARY KEY (personaggio_id, ordine)
  );

  -- Tabelle ponte verso i cataloghi.
  CREATE TABLE personaggio_incantesimi (
    personaggio_id INTEGER NOT NULL REFERENCES personaggi(id) ON DELETE CASCADE,
    incantesimo_id INTEGER NOT NULL REFERENCES incantesimi(id),
    preparato INTEGER NOT NULL,
    ordine INTEGER NOT NULL,
    PRIMARY KEY (personaggio_id, incantesimo_id)
  );
  CREATE TABLE personaggio_armi (
    personaggio_id INTEGER NOT NULL REFERENCES personaggi(id) ON DELETE CASCADE,
    arma_id INTEGER NOT NULL REFERENCES armi(id),
    ordine INTEGER NOT NULL,
    PRIMARY KEY (personaggio_id, arma_id)
  );
  CREATE TABLE personaggio_privilegi (
    personaggio_id INTEGER NOT NULL REFERENCES personaggi(id) ON DELETE CASCADE,
    privilegio_id INTEGER NOT NULL REFERENCES privilegi(id),
    ordine INTEGER NOT NULL,
    PRIMARY KEY (personaggio_id, privilegio_id)
  );
`;

// Cosa aggiunge la versione 3 allo schema 2 (esportato per i test della migrazione).
export const MIGRAZIONE_V3 = `
  CREATE TABLE armature (
    id INTEGER PRIMARY KEY,
    nome TEXT NOT NULL UNIQUE COLLATE NOCASE,
    categoria TEXT NOT NULL,           -- leggera, media, pesante
    ca INTEGER NOT NULL,
    max_des INTEGER,                   -- NULL: nessun limite al bonus di DES
    forza_min INTEGER NOT NULL DEFAULT 0,
    svantaggio_furtivita INTEGER NOT NULL DEFAULT 0,
    peso REAL NOT NULL,
    creato_da INTEGER REFERENCES utenti(id)
  );

  ALTER TABLE armi ADD COLUMN categoria TEXT;   -- semplice, guerra
  ALTER TABLE armi ADD COLUMN distanza INTEGER NOT NULL DEFAULT 0;

  CREATE TABLE razze (
    id INTEGER PRIMARY KEY,
    nome TEXT NOT NULL UNIQUE COLLATE NOCASE,
    razza_madre_id INTEGER REFERENCES razze(id), -- sottorazza: si somma alla razza madre
    taglia TEXT,
    velocita TEXT,
    bonus_for INTEGER NOT NULL DEFAULT 0,
    bonus_des INTEGER NOT NULL DEFAULT 0,
    bonus_cos INTEGER NOT NULL DEFAULT 0,
    bonus_int INTEGER NOT NULL DEFAULT 0,
    bonus_sag INTEGER NOT NULL DEFAULT 0,
    bonus_car INTEGER NOT NULL DEFAULT 0,
    bonus_a_scelta INTEGER NOT NULL DEFAULT 0,
    abilita_a_scelta INTEGER NOT NULL DEFAULT 0,
    lingue_a_scelta INTEGER NOT NULL DEFAULT 0,
    trucchetto TEXT,
    creato_da INTEGER REFERENCES utenti(id)
  );
  CREATE TABLE razza_competenze (
    razza_id INTEGER NOT NULL REFERENCES razze(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL,                -- abilita, lingua, arma, armatura, strumento_a_scelta
    nome TEXT NOT NULL,
    PRIMARY KEY (razza_id, tipo, nome)
  );
  CREATE TABLE razza_privilegi (
    razza_id INTEGER NOT NULL REFERENCES razze(id) ON DELETE CASCADE,
    privilegio_id INTEGER NOT NULL REFERENCES privilegi(id),
    ordine INTEGER NOT NULL,
    PRIMARY KEY (razza_id, privilegio_id)
  );

  CREATE TABLE background (
    id INTEGER PRIMARY KEY,
    nome TEXT NOT NULL UNIQUE COLLATE NOCASE,
    strumenti_a_scelta TEXT,           -- artigiano, musicale, gioco
    lingue_a_scelta INTEGER NOT NULL DEFAULT 0,
    mo INTEGER NOT NULL DEFAULT 0,
    privilegio_id INTEGER REFERENCES privilegi(id),
    creato_da INTEGER REFERENCES utenti(id)
  );
  CREATE TABLE background_competenze (
    background_id INTEGER NOT NULL REFERENCES background(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL,                -- abilita, strumento
    nome TEXT NOT NULL,
    PRIMARY KEY (background_id, tipo, nome)
  );
  CREATE TABLE background_oggetti (
    background_id INTEGER NOT NULL REFERENCES background(id) ON DELETE CASCADE,
    ordine INTEGER NOT NULL,
    nome TEXT NOT NULL,
    qta INTEGER NOT NULL,
    peso REAL NOT NULL,
    PRIMARY KEY (background_id, ordine)
  );

  -- Le classi sono regole nel codice (src/dati/classi.ts); qui i loro privilegi per livello.
  CREATE TABLE classe_privilegi (
    classe TEXT NOT NULL,
    sottoclasse TEXT NOT NULL DEFAULT '', -- '' = privilegio della classe
    livello INTEGER NOT NULL,
    privilegio_id INTEGER NOT NULL REFERENCES privilegi(id),
    ordine INTEGER NOT NULL,
    PRIMARY KEY (classe, sottoclasse, privilegio_id)
  );
  CREATE TABLE incantesimo_classi (
    incantesimo_id INTEGER NOT NULL REFERENCES incantesimi(id) ON DELETE CASCADE,
    classe TEXT NOT NULL,
    PRIMARY KEY (incantesimo_id, classe)
  );

  ALTER TABLE personaggi ADD COLUMN taglia TEXT NOT NULL DEFAULT 'Media';
  ALTER TABLE personaggi ADD COLUMN armatura_id INTEGER REFERENCES armature(id);
  ALTER TABLE personaggi ADD COLUMN scudo INTEGER NOT NULL DEFAULT 0;
  CREATE TABLE personaggio_competenze (
    personaggio_id INTEGER NOT NULL REFERENCES personaggi(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL,                -- lingua, strumento, arma, armatura
    nome TEXT NOT NULL,
    ordine INTEGER NOT NULL,
    PRIMARY KEY (personaggio_id, tipo, nome)
  );
`;

// Cosa aggiunge la versione 4 allo schema 3 (esportato per i test della migrazione).
export const MIGRAZIONE_V4 = `
  ALTER TABLE personaggi ADD COLUMN indebolimento INTEGER NOT NULL DEFAULT 0;
  CREATE TABLE personaggio_risorse (
    personaggio_id INTEGER NOT NULL REFERENCES personaggi(id) ON DELETE CASCADE,
    risorsa TEXT NOT NULL,             -- id della risorsa (src/dati/risorse.ts)
    usati INTEGER NOT NULL,
    PRIMARY KEY (personaggio_id, risorsa)
  );
  CREATE TABLE personaggio_condizioni (
    personaggio_id INTEGER NOT NULL REFERENCES personaggi(id) ON DELETE CASCADE,
    condizione TEXT NOT NULL,          -- id della condizione (src/dati/condizioni.ts)
    ordine INTEGER NOT NULL,
    PRIMARY KEY (personaggio_id, condizione)
  );
  CREATE TABLE personaggio_effetti (
    personaggio_id INTEGER NOT NULL REFERENCES personaggi(id) ON DELETE CASCADE,
    effetto TEXT NOT NULL,             -- id dell'effetto (src/dati/condizioni.ts)
    valore INTEGER,                    -- contatore, per gli effetti che ne hanno uno
    ordine INTEGER NOT NULL,
    PRIMARY KEY (personaggio_id, effetto)
  );
  CREATE TABLE personaggio_note (
    personaggio_id INTEGER NOT NULL REFERENCES personaggi(id) ON DELETE CASCADE,
    ordine INTEGER NOT NULL,
    id_locale INTEGER NOT NULL,
    data TEXT NOT NULL,
    categoria TEXT NOT NULL,           -- sessione, png, obiettivo, altro
    titolo TEXT NOT NULL,
    testo TEXT NOT NULL,
    fatto INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (personaggio_id, ordine)
  );
`;

// Cosa aggiunge la versione 5 allo schema 4. `personaggio_armi` si ricrea per cambiarne la chiave:
// ogni riga è una copia dell'arma, con i suoi contatori (NULL = non si contano).
const MIGRAZIONE_V5 = `
  ALTER TABLE personaggi ADD COLUMN avatar TEXT NOT NULL DEFAULT '';

  CREATE TABLE personaggio_armi_v5 (
    personaggio_id INTEGER NOT NULL REFERENCES personaggi(id) ON DELETE CASCADE,
    ordine INTEGER NOT NULL,
    id_locale INTEGER NOT NULL,
    arma_id INTEGER NOT NULL REFERENCES armi(id),
    bonus INTEGER NOT NULL DEFAULT 0,  -- arma magica +1/+2/+3
    munizioni_rimaste INTEGER,
    munizioni_massime INTEGER,
    durabilita_rimasta INTEGER,        -- con durabilita_massima NULL: colpi rimasti di un'arma danneggiata
    durabilita_massima INTEGER,
    rotta INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (personaggio_id, ordine)
  );
  INSERT INTO personaggio_armi_v5 (personaggio_id, ordine, id_locale, arma_id)
    SELECT personaggio_id, ordine, ordine + 1, arma_id FROM personaggio_armi;
  DROP TABLE personaggio_armi;
  ALTER TABLE personaggio_armi_v5 RENAME TO personaggio_armi;

  CREATE TABLE personaggio_note_campi (
    personaggio_id INTEGER NOT NULL REFERENCES personaggi(id) ON DELETE CASCADE,
    nota_ordine INTEGER NOT NULL,      -- ordine della nota in personaggio_note
    campo TEXT NOT NULL,               -- id del campo (src/dati/note.ts)
    valore TEXT NOT NULL,
    PRIMARY KEY (personaggio_id, nota_ordine, campo)
  );
`;

// Schema completo della versione attuale.
const creaSchema = (db: DatabaseSync) => {
  db.exec(SCHEMA_V2);
  db.exec(MIGRAZIONE_V3);
  db.exec(MIGRAZIONE_V4);
  db.exec(MIGRAZIONE_V5);
};

// Utente che la versione 1 creava all'apertura dell'archivio, collegato ad Alston.
// Serve solo a migrare un archivio v1 in cui la tabella `utenti` non esiste ancora.
const UTENTE_V1 = {
  username: "alan",
  hash: "scrypt$7b8aa50e792d4d58625b54e9f0157a30$5975e5f2dee28f94492f4565cd98cd9c859eee83c19ec50fd916d7abaeb50ac79dcc121a7ce76fe6dc8e2dec20a2c1a3a27574aaf8223f85fbd7a7db0da66aac",
  personaggio: "alston",
};

const esisteTabella = (db: DatabaseSync, nome: string) =>
  db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(nome) !== undefined;

// Prepara l'archivio all'apertura: crea lo schema o migra quello vecchio, poi aggiorna i cataloghi.
// Prima di migrare un archivio su file ne salva una copia accanto (`percorso`.bak-v1, .bak-v2...).
export function preparaSchema(db: DatabaseSync, percorso: string) {
  const versione = Number(db.prepare("PRAGMA user_version").get()?.user_version ?? 0);
  if (versione > VERSIONE_SCHEMA) {
    throw new Error(`Archivio creato da una versione più recente dell'app (schema ${versione}).`);
  }
  if (versione < VERSIONE_SCHEMA) {
    const v1 = versione === 0 && esisteTabella(db, "personaggi");
    const daMigrare = v1 ? 1 : versione;
    if (daMigrare > 0 && percorso !== ":memory:") copiaDiSicurezza(percorso, daMigrare);
    transazione(db, () => {
      if (v1) migraDaV1(db);
      else if (versione === 0) creaSchema(db);
      if (versione === 2) migraDaV2(db);
      if (versione === 2 || versione === 3) db.exec(MIGRAZIONE_V4);
      if (versione >= 2 && versione <= 4) db.exec(MIGRAZIONE_V5);
      db.exec(`PRAGMA user_version = ${VERSIONE_SCHEMA}`);
    });
  }
  transazione(db, () => aggiornaCataloghi(db));
}

function copiaDiSicurezza(percorso: string, versione: number) {
  let copia = `${percorso}.bak-v${versione}`;
  if (existsSync(copia)) copia = `${copia}-${Date.now()}`;
  copyFileSync(percorso, copia);
  console.info(`Archivio della versione ${versione} copiato in ${copia} prima della migrazione.`);
}

// Versione 2 → 3: nuove tabelle e colonne. Per i personaggi esistenti taglia e lingue
// si ricavano dalla razza, se è nel catalogo.
function migraDaV2(db: DatabaseSync) {
  db.exec(MIGRAZIONE_V3);
  aggiornaCataloghi(db);
  db.exec(`
    UPDATE personaggi SET taglia = COALESCE((
      SELECT COALESCE(r.taglia, m.taglia) FROM razze r LEFT JOIN razze m ON m.id = r.razza_madre_id
      WHERE r.nome = personaggi.razza
    ), taglia);
    INSERT OR IGNORE INTO personaggio_competenze (personaggio_id, tipo, nome, ordine)
      SELECT p.id, rc.tipo, rc.nome, rc.rowid
      FROM personaggi p JOIN razze r ON r.nome = p.razza
      JOIN razza_competenze rc ON rc.razza_id IN (r.id, r.razza_madre_id)
      WHERE rc.tipo IN ('lingua', 'arma', 'armatura');
  `);
}

// Versione 1: personaggi(id TEXT, dati JSON, revisione, aggiornato),
// utenti(username, hash, personaggio TEXT) e sessioni(token, username, scadenza).
function migraDaV1(db: DatabaseSync) {
  db.exec("DROP TABLE IF EXISTS sessioni");
  db.exec("ALTER TABLE personaggi RENAME TO v1_personaggi");
  const conUtenti = esisteTabella(db, "utenti");
  if (conUtenti) db.exec("ALTER TABLE utenti RENAME TO v1_utenti");
  creaSchema(db);
  aggiornaCataloghi(db);

  const vecchiUtenti = conUtenti
    ? db.prepare("SELECT username, hash, personaggio FROM v1_utenti").all()
    : [UTENTE_V1];
  const proprietari = new Map<string, number>(); // id del personaggio v1 → id del nuovo utente
  const inserisciUtente = db.prepare("INSERT INTO utenti (username, hash, creato) VALUES (?, ?, ?)");
  for (const u of vecchiUtenti) {
    const esito = inserisciUtente.run(String(u.username), String(u.hash), new Date().toISOString());
    proprietari.set(String(u.personaggio), Number(esito.lastInsertRowid));
  }

  let orfani = 0;
  for (const p of db.prepare("SELECT id, dati, revisione FROM v1_personaggi").all()) {
    const utenteId = proprietari.get(String(p.id));
    if (utenteId === undefined) {
      orfani++;
      continue;
    }
    creaPersonaggio(db, utenteId, daJSON(JSON.parse(String(p.dati))), Number(p.revisione));
  }

  // Un personaggio senza utente non si può migrare: la tabella vecchia resta, per non perderlo.
  if (orfani > 0) console.warn(`${orfani} personaggi della versione 1 senza utente: restano in v1_personaggi.`);
  else db.exec("DROP TABLE v1_personaggi");
  if (conUtenti) db.exec("DROP TABLE v1_utenti");
}
