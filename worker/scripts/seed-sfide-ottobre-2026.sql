-- Sfide di 100FT — Ottobre 2026 (le 5 decise da Francesca) + la sfida extra del mese.
-- 2 automatiche + 3 foto (una "lampo" di Halloween, 26–31 ottobre). 10 punti l'una.
-- Richiede le migrazioni 0045 (foto_richieste) e 0046 (sfide_extra). In produzione:
--   npx wrangler d1 execute 100ft-db --remote --file=scripts/seed-sfide-ottobre-2026.sql
INSERT INTO sfide (titolo, descrizione, tipo, criterio, punti, flash, foto_richieste, data_inizio, data_fine) VALUES
  ('Fai almeno 4 daily drop', 'Rispondi ad almeno 4 daily drop di ottobre.', 'traguardo', 'daily_drop:4', 10, 0, 1, '2026-10-01', '2026-10-31'),
  ('Fai almeno 8 allenamenti', 'Allenati almeno 8 volte a ottobre, in qualsiasi giorno: non servono allenamenti di fila.', 'traguardo', 'presenze:8', 10, 0, 1, '2026-10-01', '2026-10-31'),
  ('Fai almeno 2 merende consigliate', 'Prepara 2 delle merende fit del programma e carica una foto per ognuna.', 'foto', NULL, 10, 0, 2, '2026-10-01', '2026-10-31'),
  ('Muoviti fuori dalla palestra', 'Una camminata, un giro in bici, un''escursione: muoviti all''aria aperta e carica una foto.', 'foto', NULL, 10, 0, 1, '2026-10-01', '2026-10-31'),
  ('Halloween', 'Dal 26 al 31 ottobre carica una foto con un travestimento, un accessorio o un trucco di Halloween, dove vuoi tu.', 'foto', NULL, 10, 1, 1, '2026-10-26', '2026-10-31');

INSERT INTO sfide_extra (anno, mese, titolo, descrizione, punti) VALUES
  (2026, 10, 'Settimana completa', 'Ogni settimana in cui ti alleni lunedì, mercoledì e venerdì guadagni 10 punti extra.', 10);
