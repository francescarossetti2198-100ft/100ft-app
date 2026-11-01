-- Sfide di 100FT — Novembre 2026 (decise con Francesca, man mano).
-- "Porta qualcuno in palestra": sfida foto da 15 punti, non automatica perché gli ospiti
-- non hanno un account: la foto insieme in palestra fa da prova.
-- "La mia giornata": sfida a tappe (migrazione 0052), una foto per
-- missione scattata dall'app, tutte lo stesso giorno; 15 punti all'ultima, nel Feed esce il collage.
-- In produzione (prima la migrazione 0052):
--   npx wrangler d1 execute 100ft-db --remote --file=scripts/seed-sfide-novembre-2026.sql
INSERT INTO sfide (titolo, descrizione, tipo, criterio, punti, flash, foto_richieste, data_inizio, data_fine) VALUES
  ('👯 Porta qualcuno in palestra', 'Amico, amica, mamma, papà, zio, cugina, fidanzata, fidanzato… o l''amante (noi non diciamo niente 🤫). Trascina chi vuoi ad allenarsi con te un giorno a scelta di novembre: se sopravvive, scattate una foto insieme in palestra 💪😅', 'foto', NULL, 15, 0, 1, '2026-11-01', '2026-11-30'),
  ('Fai almeno 5 daily drop', 'Rispondi ad almeno 5 daily drop di novembre.', 'traguardo', 'daily_drop:5', 10, 0, 1, '2026-11-01', '2026-11-30'),
  ('🎧 Aggiungi 3 canzoni alla playlist', 'Aggiungi almeno 3 canzoni alla playlist Spotify di 100FT (la trovi in cima al Feed) e carica uno screenshot come prova 📸', 'foto', NULL, 10, 0, 1, '2026-11-01', '2026-11-30');

INSERT INTO sfide (titolo, descrizione, tipo, criterio, punti, flash, foto_richieste, missioni, data_inizio, data_fine) VALUES
  ('📸 La mia giornata', 'Racconta la tua giornata attraverso 6 foto, dalla mattina fino al rientro a casa dopo l''allenamento. Completa tutte le missioni e scopri come trascorrono la giornata gli altri atleti di 100FT!', 'foto', NULL, 15, 0, 6,
   '["Buongiorno ☀️ — Una foto della tua colazione o del primo momento della giornata.","La mia giornata 💻 — Una foto di quello che fai durante il giorno: lavoro, studio o un''attività quotidiana.","Pausa pranzo 🍽️ — Una foto del tuo pranzo.","Prima di venire in palestra 🎒 — Una foto della borsa pronta, delle scarpe o della merenda prima di partire per l''allenamento.","Compagni di allenamento 💪 — Scatta una foto insieme a una persona della palestra durante l''allenamento o alla fine della lezione!","Fine giornata 🌙 — Una foto della tua cena o del tuo momento di relax una volta tornato a casa."]',
   '2026-11-01', '2026-11-30');
