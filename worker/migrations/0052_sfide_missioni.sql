-- Sfide foto "a tappe" (novembre 2026, "La mia giornata"): la coach dà una lista di
-- missioni (Buongiorno ☀️, Pausa pranzo 🍽️, …) e l'atleta racconta UNA giornata scattando
-- una foto per missione dall'app, tutte lo stesso giorno. `missioni` = array JSON di testi;
-- se c'è, foto_richieste = numero di missioni. Si completa all'ultima, come le multi-foto,
-- e nel Feed esce come collage.
ALTER TABLE sfide ADD COLUMN missioni TEXT;

-- Indice della missione (0-based) a cui risponde la foto; NULL per le multi-foto normali.
ALTER TABLE sfide_foto ADD COLUMN missione INTEGER;
-- Giorno (ora di Roma, "YYYY-MM-DD") della foto di una missione: valgono solo le foto di
-- uno stesso giorno, se l'atleta non finisce si riparte da capo un altro giorno.
ALTER TABLE sfide_foto ADD COLUMN giorno TEXT;
-- Sfida di prova visibile a UN solo atleta (Francesca prova dal telefono con l'account di
-- Simone prima di aprirla a tutti). Non conta nei totali del mese/stagione degli altri e il
-- suo post nel Feed lo vedono solo quell'atleta e la coach. NULL = sfida per tutti.
ALTER TABLE sfide ADD COLUMN solo_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
-- Una sola foto per missione: due tap ravvicinati non la contano due volte.
CREATE UNIQUE INDEX idx_sfide_foto_missione ON sfide_foto(sfida_id, user_id, missione) WHERE missione IS NOT NULL;
