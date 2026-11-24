-- Sfide extra di dicembre 2026 (decise da Francesca il 24/11), 10 punti l'una, una volta sola.
-- "Festa di Natale 100FT": a foto (migrazione 0050), solo il 12/12: chi viene alla festa in
--   palestra si fa una foto lì, niente dress code.
-- "Allenati sotto le feste": automatica (criterio 'giorni:…', lib/bonusSettimana.ts
--   verificaExtraGiorni), scatta all'appello quando l'atleta è presente il 21, il 23 e il 28/12.
-- In produzione:
--   npx wrangler d1 execute 100ft-db --remote --file=scripts/sfide-extra-dicembre-2026.sql
INSERT INTO sfide_extra (anno, mese, titolo, descrizione, punti, foto, aperta_dal, aperta_fino) VALUES
  (2026, 12, '🎅 Festa di Natale 100FT',
   'Sabato 12 dicembre si fa festa in palestra! Vieni anche tu e scattati una foto in palestra durante la festa: chi c''è prende i punti 🎉',
   10, 1, '2026-12-12', '2026-12-12');

INSERT INTO sfide_extra (anno, mese, titolo, descrizione, punti, criterio) VALUES
  (2026, 12, '🎄 Allenati sotto le feste',
   'Allenati lunedì 21 e mercoledì 23 dicembre, prima di Natale, e lunedì 28, tra Natale e Capodanno. Se ci sei tutti e tre i giorni, i punti arrivano da soli.',
   10, 'giorni:2026-12-21,2026-12-23,2026-12-28');

-- "Daily Drop di Natale e Capodanno": automatica (criterio 'daily_drop_date:…',
-- lib/extraDailyDrop.ts). I due Daily Drop speciali sono in lib/dailyDropOrario.ts
-- (DAILY_DROP_SPECIALI): 25/12 a sorpresa 14:00–15:40 con 10 minuti per rispondere, 1/1 a
-- sorpresa 00:05–00:30 con 15 minuti. Punti datati 31/12 anche se l'ultimo è il 1° gennaio.
INSERT INTO sfide_extra (anno, mese, titolo, descrizione, punti, criterio) VALUES
  (2026, 12, '🥂 Daily Drop di Natale e Capodanno',
   'Il 25 dicembre, tra le 14 e le 16, arriva il Daily Drop di Natale: una foto con i tuoi parenti, hai 10 minuti. Subito dopo la mezzanotte di Capodanno arriva quello del brindisi, hai 15 minuti. Rispondi a tutti e due e i punti arrivano da soli!',
   10, 'daily_drop_date:2026-12-25,2027-01-01');
