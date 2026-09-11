-- Dedup del promemoria "salda l'abbonamento del mese" (18:00, dalla 2ª settimana del mese
-- a chi non ha ancora pagato). Un invio al giorno per tutti — come allenamento_notifiche.
CREATE TABLE abbonamento_notifiche (
  data TEXT PRIMARY KEY,
  inviata_il TEXT NOT NULL DEFAULT (datetime('now'))
);
