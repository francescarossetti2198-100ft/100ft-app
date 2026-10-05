-- Daily Drop: a finestra chiusa (FINESTRA_RISPOSTA_MIN dopo lo scatto) parte un secondo push
-- "Daily Drop chiuso" che sostituisce sul telefono la notifica rimasta, così nessuno la tocca
-- ore dopo pensando di poter ancora rispondere. Questo flag evita di rimandarlo a ogni tick.
ALTER TABLE daily_drop_notifiche ADD COLUMN chiusura_inviata INTEGER NOT NULL DEFAULT 0;
