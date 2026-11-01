-- Sfide extra di novembre 2026 (decise da Francesca il 1/11), 10 punti l'una, una volta sola.
-- "6 allenamenti di fila": automatica (migrazione 0053, criterio 'due_settimane'), scatta
-- all'appello quando l'atleta fa lun-mer-ven per due settimane consecutive di novembre.
-- "Vediti con qualcuno della palestra": a foto (migrazione 0050), tutto il mese.
-- In produzione (prima la migrazione 0053):
--   npx wrangler d1 execute 100ft-db --remote --file=scripts/sfide-extra-novembre-2026.sql
INSERT INTO sfide_extra (anno, mese, titolo, descrizione, punti, criterio) VALUES
  (2026, 11, '🔥 6 allenamenti di fila',
   'Allenati lunedì, mercoledì e venerdì per due settimane di fila: 6 allenamenti senza saltarne uno. I punti arrivano da soli, una volta sola.',
   10, 'due_settimane');

INSERT INTO sfide_extra (anno, mese, titolo, descrizione, punti, foto, aperta_dal, aperta_fino) VALUES
  (2026, 11, '☕ Vediti con qualcuno della palestra',
   'Esci con un compagno o una compagna di allenamento fuori dalla palestra: un caffè, una birra, una cena… quello che vuoi! Fatevi una foto insieme e caricala qui.',
   10, 1, '2026-11-01', '2026-11-30');
