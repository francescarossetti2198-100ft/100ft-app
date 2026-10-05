-- Risposte al questionario "Personalizza il tuo profilo" (JSON: { idDomanda: valore | [valori] }).
-- Le domande vivono nel frontend (config PERSONALIZZAZIONE_DOMANDE in pages/profilo.js);
-- qui si conserva solo la scelta dell'atleta. Le colonne peso / altezza / note_infortuni
-- di athlete_private c'erano già dallo schema iniziale (0001) e ora vengono usate.
ALTER TABLE athlete_private ADD COLUMN personalizzazione TEXT;
