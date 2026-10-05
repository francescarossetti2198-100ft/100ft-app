-- Gestione sfide dalla dashboard coach (agosto 2026):
--   sfide.flash   -> sfida "lampo", flag ortogonale al tipo (badge ⚡ LAMPO in UI e Feed).
--   xp_log.sfida_id -> collega i +10 punti alla sfida, così eliminando una sfida dalla
--                      dashboard si tolgono anche i punti in modo esatto (classifica ricalcolata).
ALTER TABLE sfide ADD COLUMN flash INTEGER NOT NULL DEFAULT 0;
ALTER TABLE xp_log ADD COLUMN sfida_id INTEGER;
