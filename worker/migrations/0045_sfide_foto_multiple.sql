-- Sfide foto con più foto (ottobre 2026, "Fai almeno 3 merende consigliate"): la sfida si
-- completa alla N-esima foto caricata. `foto_richieste` = 1 per tutte le sfide esistenti
-- (comportamento invariato). Le foto caricate prima dell'ultima stanno in `sfide_foto`;
-- punti, partecipazione e post nel Feed arrivano solo con l'ultima.
ALTER TABLE sfide ADD COLUMN foto_richieste INTEGER NOT NULL DEFAULT 1;

CREATE TABLE sfide_foto (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sfida_id INTEGER NOT NULL REFERENCES sfide(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  foto_url TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_sfide_foto ON sfide_foto(sfida_id, user_id);
