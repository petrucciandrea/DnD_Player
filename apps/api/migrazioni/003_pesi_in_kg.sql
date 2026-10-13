-- I pesi passano da libbre a kg (1 lb = 0,5 kg, come nel Manuale in italiano).
-- Da qui in avanti il client invia schede con `versione` 3; il server rifiuta quelle di una pagina
-- aperta prima dell'aggiornamento. La semina riscrive i pesi ufficiali già in kg (stessi valori).
UPDATE personaggio_oggetti SET peso = peso * 0.5;
UPDATE armature SET peso = peso * 0.5;
UPDATE background_oggetti SET peso = peso * 0.5;

COMMENT ON COLUMN personaggio_oggetti.peso IS 'kg per unità';
COMMENT ON COLUMN armature.peso IS 'kg';
COMMENT ON COLUMN background_oggetti.peso IS 'kg per unità';
