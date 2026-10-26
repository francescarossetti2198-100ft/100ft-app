-- Sfide foto "con votazione" (Halloween, ottobre 2026 — richiesta di Francesca): le foto si
-- caricano fino a `votazione_dal` ma restano segrete (niente Feed); da `votazione_dal` a
-- `votazione_fino` ogni atleta vota la foto più bella (non la propria); a `risultati_dal` la
-- più votata prende `punti_vincitore` in più (a pari merito tutte le prime). Orari in ora di
-- ROMA, "YYYY-MM-DD HH:MM". `votazione_chiusa` = punti già assegnati (una volta sola).
ALTER TABLE sfide ADD COLUMN votazione_dal TEXT;
ALTER TABLE sfide ADD COLUMN votazione_fino TEXT;
ALTER TABLE sfide ADD COLUMN risultati_dal TEXT;
ALTER TABLE sfide ADD COLUMN punti_vincitore INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sfide ADD COLUMN votazione_chiusa INTEGER NOT NULL DEFAULT 0;

-- Push "⚡ nuova sfida lampo" il giorno in cui si apre (lib/sfidaLampoPush.ts): 1 = già inviata.
ALTER TABLE sfide ADD COLUMN push_lampo_inviata INTEGER NOT NULL DEFAULT 0;

-- Un voto per atleta per sfida (si può cambiare finché la votazione è aperta).
CREATE TABLE voti_sfide (
  sfida_id INTEGER NOT NULL REFERENCES sfide(id) ON DELETE CASCADE,
  votante_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  votato_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (sfida_id, votante_id)
);
