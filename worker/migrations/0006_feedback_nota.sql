-- Nota facoltativa sul feedback allenamento ("How was today?"). La colonna faccina
-- (1-5) esisteva già e corrisponde esattamente alla scala fissa richiesta:
-- 1=😫 2=😕 3=😐 4=🙂 5=🔥 (mappatura tenuta lato codice, non in DB).
ALTER TABLE feedback_allenamento ADD COLUMN nota TEXT;
