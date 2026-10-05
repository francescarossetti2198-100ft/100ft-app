-- "Atleta del mese" (richiesta di Francesca 2026-09-15): riconoscimento automatico e
-- divertente, niente premio in soldi. Assegnato dal cron il giorno 1 alle 09:00 di Roma per
-- il mese appena concluso, in base ai punti xp_log dello stesso periodo della classifica
-- "Mese". La chiave include user_id per poter avere più vincitori a pari merito.
CREATE TABLE atleta_del_mese (
  mese INTEGER NOT NULL,
  anno INTEGER NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  punti INTEGER NOT NULL,
  PRIMARY KEY (mese, anno, user_id)
);
