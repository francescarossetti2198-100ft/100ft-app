# 100FT Functional Training — App Atleti
### Brief di progetto v2 per lo sviluppo (Claude Code)
*Sostituisce e integra `100FT-app-brief.md` — questo è il documento di riferimento aggiornato.*

Contesto: Francesca è coach di functional training a Centocelle, Roma. Guida sessioni di gruppo e vuole un'app per i suoi atleti.

---

## 0. Filosofia di prodotto — LEGGERE PRIMA DI TUTTO

> **100FT is not a gym management app. It is a digital extension of the 100FT training community.**
> **SHOW UP. TRAIN. IMPROVE. BELONG.**
> **The app prepares the athlete for the experience. The class IS the experience.**

**Regola non negoziabile: niente spoiler sull'allenamento.** L'app non deve mai mostrare in anticipo esercizi, workout, circuiti, timer, format della sessione. L'atleta scopre l'allenamento fisicamente durante la lezione col coach. **Nessuna sezione "Train" nell'app.** L'unica anticipazione concessa è il focus tematico del mese (es. "Mobilità"), mai il contenuto della singola sessione.

Se una nuova funzionalità rischia di sostituire l'esperienza in sala, va ripensata.

Estetica: **Dark · Editorial · Social · Premium · Minimal**. Nero `#0A0A0A`, viola `#8B5CF6`, Space Grotesk + Space Mono, ispirazione Resident Advisor. Pochi elementi, molto gerarchizzati. Non deve sembrare una app fitness piena di grafici e numeri.

---

## 1. Stack tecnico

- **Piattaforma**: PWA (non nativa) — installabile da browser, niente store
- **Frontend + hosting**: Cloudflare Pages
- **Backend/API**: Cloudflare Workers
- **Database**: Cloudflare D1
- **Storage foto**: Cloudflare R2 (solo per la challenge Daily Drop, vedi sez. 8)
- **Email transazionali**: Resend (recupero password)

---

## 2. Autenticazione

- **Coach**: password personale separata → pannello admin (Coach Dashboard, sez. 15)
- **Atleti**: email + password personale, account individuale e privato
- Recupero password via email (Resend)

---

## 3. Schema dati (D1) — struttura raffinata

Separazione netta tra autenticazione, profilo pubblico e dati privati (privacy gestita **server-side**, mai solo nascosta in UI):

- **`users`**: id, email, password_hash, role (atleta/coach), status, created_at
- **`athlete_profile`** (pubblico, visibile al gruppo): user_id, nome, cognome, nickname, foto, data_nascita
- **`athlete_private`** (solo coach): user_id, peso, altezza, obiettivi, note_infortuni, aree_miglioramento — **mai restituito dalle API destinate ad altri atleti**
- **`programma_mensile`**: id, mese, anno, focus_tema, descrizione, linee_guida_nutrizionali, merende_fit
- **`sessioni_gruppo`**: id, giorno_settimana, ora_inizio, ora_fine, tipo (A/B/C, color-coded)
  - **`presenze`**: id, user_id, sessione_id, data, confermata (solo giorno stesso)
- **`richieste_pre_allenamento`**: id, user_id, sessione_id, categoria (Legs/Mobility/Upper Body/Conditioning/Other) o testo libero, data — **vista pubblica aggregata e anonima** (conteggi per categoria), **vista coach con nome dell'atleta**
- **`sfide`** + **`partecipazioni_sfide`**: come da brief precedente (validazione automatica per tipo=presenza, upload solo per Daily Drop)
- **`personal_best`**: id, user_id, esercizio (push-ups/plank/squat/jump rope/1km/altro definito dal coach), valore, data, is_new_pb (bool)
- **`milestones`**: id, user_id, tipo (first_session/10_sessions/25_sessions/first_month/hydration_hero/team_player/new_pb), data_raggiunta
- **`athlete_of_the_week`**: id, user_id, settimana, motivazione (testo libero del coach)
- **`xp_log`**: id, user_id, azione, xp_assegnati, data — usato per calcolare month_score e season_score (mai sommato in una tabella fissa, sempre calcolato)
- **`post_feed`**: id, user_id (nullable per post generati dal sistema), tipo (level_up/new_pb/consistency/athlete_of_week/daily_drop/annuncio_coach), contenuto_url, testo, data, reazioni
- **`feedback_allenamento`**: id, user_id, sessione_id, faccina (scala 5), miglioramento (Mobility/Strength/Technique/Conditioning/Other) — solo chi era presente
- **`pagamenti`**: id, user_id, mese, anno, stato, data_pagamento
- **`audit_log`** (fase 2, non MVP): id, coach_id, azione, dettaglio, data — traccia modifiche sensibili (es. pagamento segnato, dati privati aggiornati)

**Punteggi**: MAI tabelle di totali fissi. Sempre calcolati al volo da `xp_log`:
- **Level**: permanente, cumulativo da sempre (non si azzera mai)
- **Season Score**: si azzera a ogni nuova stagione (settembre)
- **Month Score**: si azzera ogni mese

---

## 4. Sistema punti (aggiornato 2026-08)

| Azione | Punti |
|---|---|
| Presenza confermata dalla coach (appello digitale) | +10 |
| Sfida completata | +10 |
| Tutte le sfide del mese completate | +10 (bonus) |
| Daily Drop | +5 |
| Feedback post-allenamento | +2 |
| Questionario mensile | +15 |

I punti sono sempre calcolati al volo da `xp_log`. La classifica (Settimana/Mese/Totale) li somma tutti. I livelli NON usano i punti (vedi sezione 5).

---

## 5. Sistema di livelli (permanente, non si azzera)

Cumulativo, non a streak — si sale in base al **numero di allenamenti** (presenze confermate dalla coach), anche non consecutivi. Gli anelli settimanali della Home sono solo una statistica e non incidono sul livello.

| Livello | Nome | Allenamenti richiesti | Colore |
|---|---|---|---|
| 1 | Facile | 3–17 | Verde `#8BC53F` |
| 2 | Inizio | 18–35 | Blu `#2D7DD2` |
| 3 | Intermedio | 36–59 | Oro `#F4B740` |
| 4 | Avanzato | 60–74 | Arancio `#FF7A29` |
| 5 | Esperto | 75–89 | Rosso `#E63946` |
| 6 | Leggendario | 90+ | Viola `#A85CFF` |

(Equivalenti a 1/6/12/20/25/30 settimane da 3 allenamenti — calibrati sul calendario stagionale di 11 mesi.)

Asset grafici pronti: `card_final_1.png` … `card_final_6.png`.

---

## 6. Navigazione principale (5 sezioni, NIENTE sezione "Train")

**HOME** · **PROGRAM** · **CHALLENGES** · **FEED** · **PROFILE**

---

## 7. HOME — la schermata più importante, dinamica nel corso della giornata

Deve rispondere in pochi secondi a "cosa succede oggi a 100FT". Cambia stato durante il giorno:

- **Mattina**: saluto, richiamo alla sessione serale, quanti atleti hanno già confermato
- **Prima della sessione**: countdown, richieste "cosa vuoi allenare oggi" ancora aperte
- **Dopo la sessione**: recap (atleti allenati, PB del giorno, level up), invito al feedback

**Componenti fissi:**
- **Today**: presenza di oggi, conferma con un tap, **nessuna anteprima del contenuto della sessione**
- **In The Room**: chi si allena oggi, mostrato come community (avatar/nomi), non come lista amministrativa — obiettivo: effetto "ci sono anche loro, allora vado"
- **Before Training**: richiesta pre-sessione, categorie predefinite (Legs/Mobility/Upper Body/Conditioning/Other) + testo libero. **Non deve mai anticipare l'allenamento**, serve solo a raccogliere preferenze
- **Today's Requests**: vista aggregata pubblica (conteggi per categoria, anonima); il coach vede anche il nome di chi ha fatto ciascuna richiesta
- **Coach Note**: messaggio breve e personale del coach, editabile da admin, tono libero (motivazionale, ironico, provocatorio)
- **This Month**: focus tematico del mese, mai il contenuto della singola lezione
- **Your Progress**: card livello attuale + barra di progresso cumulativo

**Dopo la sessione, compare:**
- **How Was Today?**: feedback a 5 faccine — **compilabile solo da chi era presente**
- **What Did You Improve Today?**: Mobility/Strength/Technique/Conditioning/Other

---

## 8. Daily Drop (ex "Ricordati di bere") — stile BeReal

- Notifica push a orario casuale, finestra di **5 minuti**
- Fotocamera doppia (foto principale + selfie in overlay)
- Contatore sociale ("37 atleti hanno già risposto")
- +10 XP alla pubblicazione, foto finisce nel Feed
- Nota tecnica: orario random + countdown vanno gestiti lato server (Workers + Durable Objects o cron scheduled worker)

---

## 9. PROGRAM

Non un elenco di workout — più simile a un piccolo magazine mensile:
- **This Month**: focus tematico + breve introduzione
- **Training Focus**: spiegazione generale del tema (mai esercizi specifici)
- **Nutrition**: linee guida generali, disclaimer sempre visibile ("non sostituisce un nutrizionista")
- **Fit Snacks**: 2-3 card mensili (es. "Yogurt greco + frutti di bosco — pre-allenamento")
- Mesi futuri **bloccati** (icona lucchetto), niente spoiler sul programma

---

## 10. CHALLENGES

- **Classifiche multiple** (non una sola generale, per evitare che chi ha iniziato prima diventi irraggiungibile):
  - Month (classifica del mese)
  - Season (classifica della stagione)
  - Improvement (basata sul miglioramento personale, non sui punti totali)
  - All Time (solo statistiche storiche)
- Lista sfide attive con punti
- **Personal Best**: parametri misurabili (push-up, plank, squat, corda, 1km, altri definiti dal coach) — competizione principalmente con se stessi, badge "New PB" con % di miglioramento
- **Milestones**: First Session, 10 Sessions, 25 Sessions, First Month, Hydration Hero, Team Player, New PB — raccolte in una sezione "Achievements" nel Profile

---

## 11. FEED — "The 100FT Community Board", non un Instagram della palestra

Post generati automaticamente dal sistema + post manuali:
- Level Up
- New PB
- Consistency (es. "4 settimane di fila")
- Athlete of the Week
- Daily Drop
- Annunci del coach

Reazioni semplici (emoji), non un sistema social complesso.

---

## 12. Athlete of the Week

- Il coach sceglie ogni settimana un atleta (non necessariamente il più forte — per costanza, miglioramento, atteggiamento, supporto agli altri)
- Testo libero motivazionale del coach
- Appare nel Feed e nel Profilo dell'atleta scelto

---

## 13. Season System

- **Stagione**: settembre → luglio (es. "100FT Season 01 · Sep 2026 → Jul 2027")
- A fine stagione lo storico si conserva, parte una nuova stagione
- **Level**: permanente, mai azzerato
- **Season Score**: si azzera ogni nuova stagione
- **Month Score**: si azzera ogni mese

*(Questo chiude una delle domande aperte del brief precedente.)*

---

## 14. PROFILE

- Card livello attuale (permanente) + carosello scala livelli (`card_final_1..6.png`)
- Achievements (milestones raccolte)
- Personal Best personali
- Dati pubblici vs privati (questi ultimi mai esposti via API ad altri atleti)
- Stato pagamento del mese

---

## 15. Coach Dashboard (pannello admin)

Orientato all'azione, non solo lettura dati:
- **Today**: sessioni del giorno con presenze in tempo reale (es. "19:00 — C, 14/18 atleti")
- **Today's Requests**: conteggi per categoria + nomi (solo lato coach)
- **Payments**: riepilogo pagati/mancanti
- **Needs Attention**: alert automatici per atleti inattivi da tempo (es. "Luca — ultima sessione 12 giorni fa", "Sara — 3 sessioni saltate") — permette di intervenire prima che un atleta abbandoni
- Gestione Coach Note, Athlete of the Week, Focus del mese, Merende fit, Sfide

---

## 16. Orari reali delle sessioni

- Lunedì e Mercoledì: 19:30–20:30
- Venerdì: 19:00–20:00

---

## 17. Priorità di sviluppo (definite da Francesca)

**MUST HAVE (MVP):**
Login · Presenze · Home dinamica · Programma mensile · Challenge · XP/Levels · Feed · Coach Dashboard · Pagamenti · Push Notifications · Before Training Requests · Privacy server-side

**HIGH VALUE (subito dopo l'MVP):**
Personal Best · Milestones · Athlete of the Week · Coach Alerts (Needs Attention) · Season System · Classifiche multiple

**NICE TO HAVE:**
Daily Drop con doppia camera · Reazioni nel Feed · Statistiche avanzate · Grafici · Animazioni

**PHASE 2 (non ora):**
Apple Health / Google Fit · Tracking workout avanzato · Video esercizi · Messaggistica privata · AI Coach

---

## 18. Domande ancora aperte

- I mesi passati del programma restano consultabili una volta chiusi, o si bloccano anche quelli?
- Nome definitivo del brand/logo (rebranding rimandato a fine progetto)

---

## Asset disponibili (da questa chat)

- `100ft-app-mockup-v17.html` — mockup di riferimento (nota: alcune sezioni, es. le richieste pre-allenamento con nomi visibili pubblicamente, vanno aggiornate secondo la sez. 7 di questo brief — la versione corretta è **aggregata e anonima** in pubblico)
- `card_final_1.png` … `card_final_6.png` — carte livello
- `logo-100ft-white.png`, `logo-100ft-violet.png`, `logo-100ft-black.png` — logo ripulito (rebranding completo rimandato)

---

## Ispirazione di prodotto (logiche, non grafica)

SugarWOD (community/leaderboard/coach) · Wodify (performance tracking/PR) · Beyond the Whiteboard (statistiche/storico) · Strava (community/challenge/progressione sociale)

> 100FT lives in your pocket, but the real experience happens in the room.
