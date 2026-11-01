-- Pubblicazione anticipata di un mese del programma agli atleti.
-- Di default un mese è visibile agli atleti solo quando la sua data è arrivata
-- (blocco anti-spoiler, vedi sbloccato() in worker/src/routes/programma.ts).
-- pubblicato = 1 → il coach lo rende visibile in anticipo (programma + sfide del mese).
ALTER TABLE programma_mensile ADD COLUMN pubblicato INTEGER NOT NULL DEFAULT 0;
