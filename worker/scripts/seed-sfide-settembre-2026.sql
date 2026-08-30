-- Sfide di 100FT — Settembre 2026 (le 5 decise da Francesca).
-- 4 "traguardo" (si completano da sole) + 1 sfida foto. 10 punti l'una.
-- In produzione: applicare solo dopo conferma, con
--   npx wrangler d1 execute 100ft-db --remote --file=scripts/seed-sfide-settembre-2026.sql
INSERT INTO sfide (titolo, descrizione, tipo, criterio, punti, data_inizio, data_fine) VALUES
  ('Completa "Il tuo profilo" e "I tuoi dati"', 'Carica la foto profilo e compila i tuoi dati.', 'traguardo', 'profilo_completo', 10, '2026-09-01', '2026-09-30'),
  ('Completa i tuoi obiettivi personali', 'Rispondi al questionario "Obiettivi personali".', 'traguardo', 'obiettivi_completi', 10, '2026-09-01', '2026-09-30'),
  ('Fai almeno un daily drop', 'Rispondi al daily drop quando arriva.', 'traguardo', 'daily_drop', 10, '2026-09-01', '2026-09-30'),
  ('Fatti un selfie con Cosimo', 'Carica la foto del selfie con Cosimo.', 'foto', NULL, 10, '2026-09-01', '2026-09-30'),
  ('Effettua 6 presenze', 'Registra 6 presenze confermate a settembre.', 'traguardo', 'presenze:6', 10, '2026-09-01', '2026-09-30');
