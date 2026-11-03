-- Resistenze, immunità e vulnerabilità scritte a mano sulla scheda (oggetti magici, talenti...).
-- Quelle di razza, classe, condizioni ed effetti si derivano nel codice (@dnd/regole/dati/danni.ts).
-- Solo una tabella nuova: il codice precedente continua a funzionare durante il deploy.
CREATE TABLE personaggio_difese (
  personaggio_id integer NOT NULL REFERENCES personaggi(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('resistenza', 'immunita', 'vulnerabilita')),
  danno text NOT NULL,               -- id del tipo di danno (TIPI_DANNO)
  nota text NOT NULL DEFAULT '',
  ordine integer NOT NULL,
  PRIMARY KEY (personaggio_id, tipo, danno)
);
