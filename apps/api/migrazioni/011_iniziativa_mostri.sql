-- Dati dei mostri e PNG del Master nel tracker d'iniziativa: CA, PF, condizioni e note.
-- Li vede solo il Master; ai giocatori arriva il nome e uno stato di salute senza numeri.
-- Solo colonne nuove con DEFAULT: il codice precedente continua a funzionare.
ALTER TABLE party_iniziativa
  ADD COLUMN ca integer,
  ADD COLUMN pf integer,
  ADD COLUMN pf_massimi integer,
  ADD COLUMN condizioni text[] NOT NULL DEFAULT '{}',
  ADD COLUMN note text NOT NULL DEFAULT '';
