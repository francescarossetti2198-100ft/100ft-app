-- Simulazione del Daily Drop per un singolo atleta (bottone "Simula Daily Drop" nella
-- scheda atleta della coach): apre una finestra di risposta valida SOLO per quell'utente,
-- senza toccare il Daily Drop reale di quel giorno. La riga si cancella da sola alla
-- risposta o quando scade.
CREATE TABLE daily_drop_test (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  scade_il TEXT NOT NULL -- datetime('now') + finestra, in UTC
);
