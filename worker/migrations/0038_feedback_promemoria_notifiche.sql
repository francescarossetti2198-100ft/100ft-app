-- Dedup della push "hai fatto il feedback post-allenamento?" mandata alle 21:00 nei giorni
-- di allenamento a chi era presente ma non l'ha ancora lasciato (stesso pattern di
-- daily_drop_notifiche / allenamento_notifiche / merenda_notifiche).
CREATE TABLE feedback_promemoria_notifiche (data TEXT PRIMARY KEY); -- "YYYY-MM-DD"
