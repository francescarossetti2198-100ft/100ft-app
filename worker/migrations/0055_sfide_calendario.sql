-- Sfide a tappe "a calendario" (dicembre 2026, calendario dell'Avvento di Francesca): ogni
-- missione ha il giorno da cui si sblocca (i giorni di allenamento) e da lì si può fare quando
-- si vuole, fino a data_fine. Non vale la regola "tutte lo stesso giorno" delle tappe normali.
-- `missioni_dal` = array JSON di date "YYYY-MM-DD", una per missione; NULL = tappe normali.
-- Agli atleti il testo di una casella ancora chiusa non arriva (sorpresa).
ALTER TABLE sfide ADD COLUMN missioni_dal TEXT;
-- Foto per casella (array JSON di numeri, NULL = 1 per tutte). Con 2 (es. "Prima e dopo"
-- l'allenamento) l'atleta sceglie due foto e l'app le unisce in un collage verticale (prima sopra, dopo sotto)
-- prima di caricarla: per il server resta una foto sola.
ALTER TABLE sfide ADD COLUMN missioni_foto TEXT;
-- Didascalia facoltativa (max 200 caratteri) della foto di una casella del calendario: si
-- vede sotto la foto nel carosello "Le foto di tutti", l'atleta può cambiarla dopo.
ALTER TABLE sfide_foto ADD COLUMN didascalia TEXT;
-- Collage di gruppo del calendario: a `collage_dal` (ora di Roma, "YYYY-MM-DD HH:MM") il cron
-- pubblica nel Feed, come post della coach, un collage per casella con le foto di tutti
-- (lib/calendarioCollage.ts). `collage_pubblicati` = già fatto (una volta sola).
ALTER TABLE sfide ADD COLUMN collage_dal TEXT;
ALTER TABLE sfide ADD COLUMN collage_pubblicati INTEGER NOT NULL DEFAULT 0;
-- Post del Feed che è il collage di una casella: JSON {"sfida": id, "missione": n}.
ALTER TABLE post_feed ADD COLUMN calendario TEXT;
