-- Posizione in classifica di ogni atleta, per periodo (settimana/mese/totale).
-- Serve alla freccia ▲/▼: mostra l'ultimo spostamento reale in classifica (un sorpasso di
-- punti), non il confronto con un periodo passato.
--   posizione       = posizione registrata all'ultimo giro
--   posizione_prec  = posizione immediatamente prima dell'ultimo cambio
-- Aggiornata da GET /api/sfide/classifica quando una posizione cambia.

CREATE TABLE classifica_posizioni (
  periodo TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  posizione INTEGER NOT NULL,
  posizione_prec INTEGER,
  aggiornata_il TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (periodo, user_id)
);
