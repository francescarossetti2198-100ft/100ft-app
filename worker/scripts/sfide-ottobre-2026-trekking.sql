-- Ottobre 2026: trekking ai Castelli Romani (domenica 18) come sfida extra a parte da 15 punti,
-- e "Muoviti fuori dalla palestra" chiarita: il trekking NON vale come uscita, sono 2 sfide parallele.
-- In produzione:
--   npx wrangler d1 execute 100ft-db --remote --file=scripts/sfide-ottobre-2026-trekking.sql
UPDATE sfide
SET descrizione = 'Una camminata, un giro in bici, un''escursione: muoviti all''aria aperta per conto tuo e carica una foto.'
WHERE titolo = 'Muoviti fuori dalla palestra' AND data_inizio = '2026-10-01';

INSERT INTO sfide_extra (anno, mese, titolo, descrizione, punti, data) VALUES
  (2026, 10, '🥾 Trekking ai Castelli Romani',
   'Domenica 18 ottobre camminiamo insieme! 🌳 Arrivati al punto panoramico scatta una foto e pubblicala nel Feed 📸 Sfida a parte: non vale per «Muoviti fuori dalla palestra».',
   15, '2026-10-18');
