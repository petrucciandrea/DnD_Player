-- Un oggetto dello Zaino può essere "del party": lo porta il personaggio (pesa nel suo zaino e lo gestisce lui),
-- ma compare nel tesoro comune del party. Solo una colonna nuova con DEFAULT: il codice precedente continua a funzionare.
ALTER TABLE personaggio_oggetti ADD COLUMN del_party boolean NOT NULL DEFAULT false;
