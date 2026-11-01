-- Personalizzazione dell'anello attorno alla foto profilo dell'atleta (colore, stile,
-- intensità). JSON: {"colore":"viola","stile":"solid","intensita":"medio"} o NULL =
-- nessuna personalizzazione (bordo neutro di default). Sostituisce card_colore (che
-- tingeva l'intera pagina Profilo) come customizzazione visiva dell'atleta; card_colore
-- resta nello schema inutilizzata, per non perdere dati storici.
ALTER TABLE athlete_profile ADD COLUMN foto_personalizzazione TEXT;
