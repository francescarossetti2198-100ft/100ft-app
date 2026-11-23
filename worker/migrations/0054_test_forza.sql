-- Test di forza (novembre 2026): la coach segna nel Diario i giorni di test, gli atleti
-- inseriscono i propri risultati dalla card "Il tuo allenamento di oggi" in Home.
-- I test sono definiti nel codice (lib/testForza.ts); `risultati` è un JSON {chiave: valore}
-- così aggiungere o cambiare un test non richiede una migrazione.
-- Visibili solo all'atleta stesso e alla coach.
ALTER TABLE diario_allenamenti ADD COLUMN test_forza INTEGER NOT NULL DEFAULT 0;

CREATE TABLE test_forza_risultati (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  risultati TEXT NOT NULL,
  aggiornato_il TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, data)
);
