-- Il contenuto mensile del programma passa da 1 paragrafo unico a blocchi separati
-- (OBIETTIVO / PERCHÉ QUESTO MESE / RISULTATO ATTESO + parte nutrizionale strutturata),
-- come li scrive la coach. La vecchia colonna `descrizione` resta per i mesi già inseriti
-- e come fallback; `linee_guida_nutrizionali` ora contiene l'elenco puntato (una riga per punto).
ALTER TABLE programma_mensile ADD COLUMN obiettivo TEXT;
ALTER TABLE programma_mensile ADD COLUMN perche_mese TEXT;
ALTER TABLE programma_mensile ADD COLUMN risultato_atteso TEXT;
ALTER TABLE programma_mensile ADD COLUMN focus_nutrizionale TEXT;
ALTER TABLE programma_mensile ADD COLUMN obiettivo_nutrizionale TEXT;
