-- Giorni senza allenamento per festività / chiusura palestra. Un giorno qui dentro che
-- cade su un giorno di sessione (lun/mer/ven) non conta più negli anelli settimanali
-- TRAINING e FEEDBACK: quella settimana diventa 2/2 invece di 3/3.
CREATE TABLE giorni_chiusi (
  data TEXT PRIMARY KEY,            -- YYYY-MM-DD
  motivo TEXT,
  creato_il TEXT NOT NULL DEFAULT (datetime('now'))
);
