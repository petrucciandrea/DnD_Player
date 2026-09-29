import { copyFileSync, existsSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";
import { daJSON } from "../src/scheda.ts";
import { aggiornaCataloghi } from "./catalogo.ts";
import { creaPersonaggio } from "./personaggi.ts";
import { transazione } from "./transazione.ts";

// Versione dello schema, salvata in PRAGMA user_version.
// 1 (implicita, user_version 0): una riga JSON per personaggio, utenti con un solo personaggio.
// 2: dati del personaggio in tabelle, cataloghi condivisi, più personaggi per utente.
export const VERSIONE_SCHEMA = 2;

const SCHEMA = `
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
// Prima di migrare un archivio su file ne salva una copia accanto (`percorso`.bak-v1).
export function preparaSchema(db: DatabaseSync, percorso: string) {
  const versione = Number(db.prepare("PRAGMA user_version").get()?.user_version ?? 0);
  if (versione > VERSIONE_SCHEMA) {
    throw new Error(`Archivio creato da una versione più recente dell'app (schema ${versione}).`);
  }
  if (versione < VERSIONE_SCHEMA) {
    const v1 = esisteTabella(db, "personaggi");
    if (v1 && percorso !== ":memory:") copiaDiSicurezza(percorso);
    transazione(db, () => {
      if (v1) migraDaV1(db);
      else db.exec(SCHEMA);
      db.exec(`PRAGMA user_version = ${VERSIONE_SCHEMA}`);
    });
  }
  transazione(db, () => aggiornaCataloghi(db));
}

function copiaDiSicurezza(percorso: string) {
  let copia = `${percorso}.bak-v1`;
  if (existsSync(copia)) copia = `${percorso}.bak-v1-${Date.now()}`;
  copyFileSync(percorso, copia);
  console.info(`Archivio della versione 1 copiato in ${copia} prima della migrazione.`);
}

// Versione 1: personaggi(id TEXT, dati JSON, revisione, aggiornato),
// utenti(username, hash, personaggio TEXT) e sessioni(token, username, scadenza).
function migraDaV1(db: DatabaseSync) {
  db.exec("DROP TABLE IF EXISTS sessioni");
  db.exec("ALTER TABLE personaggi RENAME TO v1_personaggi");
  const conUtenti = esisteTabella(db, "utenti");
  if (conUtenti) db.exec("ALTER TABLE utenti RENAME TO v1_utenti");
  db.exec(SCHEMA);
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
