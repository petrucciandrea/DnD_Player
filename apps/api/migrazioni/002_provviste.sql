-- Provviste: oggetti dell'inventario che si consumano (razioni, olio, torce…).
-- Solo colonne con DEFAULT: il codice precedente continua a funzionare durante il deploy.
ALTER TABLE personaggio_oggetti
  ADD COLUMN consumabile boolean NOT NULL DEFAULT false,
  ADD COLUMN consumo_giornaliero double precision NOT NULL DEFAULT 0; -- unità al giorno
