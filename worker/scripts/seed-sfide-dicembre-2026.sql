-- Sfide di 100FT — Dicembre 2026 (idee di Francesca del 24/11).
-- (La "Festa di Natale 100FT" del 12/12 è nelle sfide extra: sfide-extra-dicembre-2026.sql.)
-- "Il mio Natale": sfida a tappe come "La mia giornata" (migrazione 0052), solo il 25/12,
--   una foto per missione tutte nello stesso giorno; nel Feed esce il collage.
-- "Il regalo più brutto": foto CON VOTAZIONE (migrazione 0051), come Halloween. Foto dal
--   1/12 a Natale compreso, segrete; voto dal 26/12 a fine 30/12, anonimo (nomi nascosti
--   fino ai risultati, commit 9eeeab7); risultato il 31/12 alle 12:00, +10 alla più votata.
-- "Natale senza sensi di colpa": foto per tutto il mese.
-- In produzione:
--   npx wrangler d1 execute 100ft-db --remote --file=scripts/seed-sfide-dicembre-2026.sql
INSERT INTO sfide (titolo, descrizione, tipo, criterio, punti, flash, foto_richieste, data_inizio, data_fine) VALUES
  ('🍰 Natale senza sensi di colpa', 'A Natale si mangia, si ride e si sta insieme. La palestra è importante, ma i sensi di colpa restano fuori dalla porta! Carica una foto del piatto o del dolce delle feste che ti sei goduto di più, senza pensarci due volte 😋', 'foto', NULL, 10, 0, 1, '2026-12-01', '2026-12-31');

INSERT INTO sfide (titolo, descrizione, tipo, criterio, punti, flash, foto_richieste, missioni, data_inizio, data_fine) VALUES
  ('🎄 Il mio Natale', 'Racconta il tuo 25 dicembre in 6 foto, dal risveglio fino a sera. Completa tutte le missioni e scopri come hanno passato il Natale gli altri atleti di 100FT!', 'foto', NULL, 15, 0, 6,
   '["Buon Natale ☀️ — Una foto del risveglio o della colazione di Natale.","L''albero 🎄 — Una foto del tuo albero, del presepe o degli addobbi di casa.","Pacchetti 🎁 — Una foto dei regali: da aprire, aperti o la carta strappata ovunque.","Il pranzo 🍝 — Una foto della tavola o del piatto forte del pranzo di Natale.","Tutti insieme 👨‍👩‍👧 — Una foto con le persone con cui passi il Natale.","La sera 🌙 — Una foto di come finisci la giornata: tombola, film, divano o avanzi."]',
   '2026-12-25', '2026-12-25');

INSERT INTO sfide (titolo, descrizione, tipo, criterio, punti, flash, foto_richieste, data_inizio, data_fine,
                   votazione_dal, votazione_fino, risultati_dal, punti_vincitore) VALUES
  ('🎁 Il regalo più brutto',
   'Ogni Natale ce n''è uno: il maglione improbabile, il soprammobile misterioso, i calzini con le renne 🦌. Carica la foto del regalo più brutto che hai ricevuto… o che hai visto ricevere a qualcun altro 😅 Hai tempo fino a Natale compreso. Dal 26 al 30 dicembre si vota il più brutto, e nessuno sa di chi è! Il risultato esce il 31 dicembre a mezzogiorno: al regalo più votato vanno 10 punti in più.',
   'foto', NULL, 10, 0, 1, '2026-12-01', '2026-12-30',
   '2026-12-26 00:00', '2026-12-31 00:00', '2026-12-31 12:00', 10);

-- "Calendario dell'Avvento": sfida a calendario (migrazione 0055). 12 caselle: una per ogni
-- giorno di allenamento dal 2 al 23/12, più la Vigilia (24) e Natale (25) con lo chef; ogni casella si sblocca quel giorno e si può fare
-- quando si vuole dopo, fino al 29/12. Cose natalizie da fare FUORI dalla palestra
-- (Francesca, 24/11), tranne il 4/12 "Prima e dopo" in palestra con un compagno: 2 foto
-- unite dall'app (missioni_foto). Toccando un giorno si vedono le foto di tutti;
-- ogni foto esce subito nella sezione "Avvento" del Feed (reazioni e commenti) e il
-- 30/12 alle 10:00 il cron pubblica un collage di gruppo per casella (collage_dal).
-- Punti alla dodicesima casella; nel Feed esce anche il collage personale di chi completa.
INSERT INTO sfide (titolo, descrizione, tipo, criterio, punti, flash, foto_richieste, missioni, missioni_dal, missioni_foto, collage_dal, data_inizio, data_fine) VALUES
  ('🗓️ Calendario dell''Avvento', 'Ogni giorno di allenamento si apre una nuova casella con una piccola missione natalizia, quasi sempre da fare fuori dalla palestra, più due caselle speciali per la Vigilia e Natale. Non serve farla quel giorno: puoi recuperarla quando vuoi, entro il 29 dicembre. Le foto di tutti le vedi subito nel Feed, nella sezione Avvento, e il 30 dicembre escono i collage di ogni giorno con le foto di tutti. Completa tutte e 12 le caselle!', 'foto', NULL, 20, 0, 12,
   '["Le luci di Natale ✨ — Una foto delle luminarie della tua via o della tua città.","Prima e dopo 💪 — Allenati con un compagno o una compagna di allenamento: scattate una foto insieme in palestra prima dell''allenamento e una dopo. L''app le unisce in un collage, una sopra e una sotto.","Addobba 🎄 — L''albero, il presepe o anche solo un addobbo, a casa o in ufficio.","Serata film 🎬 — Divano, coperta e un film sullo schermo: quello che vuoi tu, non per forza di Natale.","Passeggiata in centro 🏛️ — Fatti un giro nel centro di Roma addobbato per Natale (Piazza Navona, Via del Corso, Piazza di Spagna…) e scatta una foto.","Dolci fatti in casa 🍪 — Biscotti, panpepato o quello che vuoi tu, fatti da te.","Mercatino di Natale 🛍️ — Una foto da un mercatino di Natale.","Qualcosa di caldo ☕ — Una tazza fumante di cioccolata calda o vin brulé.","Incarta un regalo 🎁 — Più è storto, meglio è.","La spesa delle feste 🛒 — Il carrello pieno o la spesa pronta per il cenone.","Lo chef della Vigilia 👨‍🍳 — Una foto con la chef o lo chef della cena della Vigilia.","Lo chef di Natale 🍽️ — Una foto con la chef o lo chef del pranzo di Natale. Se è la stessa persona della Vigilia va benissimo, rifatela!"]',
   '["2026-12-02","2026-12-04","2026-12-07","2026-12-09","2026-12-11","2026-12-14","2026-12-16","2026-12-18","2026-12-21","2026-12-23","2026-12-24","2026-12-25"]',
   '[1,2,1,1,1,1,1,1,1,1,1,1]',
   '2026-12-30 10:00',
   '2026-12-01', '2026-12-29');
