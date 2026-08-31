// "YOUR WEEK" — i 3 anelli della Home: TRAINING / CHALLENGES / FEEDBACK.
// Sostituisce il vecchio sistema (Allenamenti/Sfide/Streak): lo "streak" a settimane
// consecutive è stato eliminato su richiesta esplicita — le settimane completate sono
// cumulative, non un filotto che si azzera se ne salti una.
//
// - TRAINING: presenze confermate questa settimana / sessioni programmate questa settimana.
// - CHALLENGES: sfide completate questo MESE / numero di sfide di quel mese (l'anello si
//   chiude facendo tutte le sfide del mese; il denominatore cambia mese per mese in base a
//   quante sfide ha inserito la coach). Basato sul numero di sfide, non sui punti XP.
// - FEEDBACK: feedback dati questa settimana / sessioni programmate questa settimana (stesso
//   denominatore di TRAINING — 3 allenamenti a settimana = 3 feedback post-workout attesi).
//
// "Settimana completata" = tutti e 3 gli anelli chiusi quella settimana. Per una settimana
// passata, la quota CHALLENGES si valuta sul mese a cui appartiene (il mese del suo lunedì —
// approssimazione per le rare settimane a cavallo di due mesi). Le settimane complete sono
// cumulative e alimentano i livelli (lib/livelli.ts, soglie invariate).
//
// Nota sulle "settimane anomale" (festività, chiusura palestra...): il denominatore di
// TRAINING è il numero di righe in sessioni_gruppo, non ancora legato a un calendario di
// eccezioni per singola data — richiederebbe una tabella dedicata e una UI coach (Coach
// Dashboard, non ancora costruita). Da fare quando servirà davvero.

import { adessoRoma } from "./oggi";

// Numero di sfide per mese ("YYYY-MM" -> quante). È il denominatore dell'anello CHALLENGES:
// chiudi l'anello facendo tutte le sfide di quel mese.
async function sfidePerMesePubblicate(db: D1Database): Promise<Map<string, number>> {
  const { results } = await db
    .prepare(`SELECT substr(data_inizio, 1, 7) AS mese, COUNT(*) AS n FROM sfide GROUP BY mese`)
    .all<{ mese: string; n: number }>();
  return new Map(results.map((r) => [r.mese, r.n]));
}

export function inizioSettimana(d: Date): Date {
  const copia = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const giorno = (copia.getUTCDay() + 6) % 7; // 0 = lunedì
  copia.setUTCDate(copia.getUTCDate() - giorno);
  return copia;
}

export function weekKey(d: Date): string {
  // Stessa convenzione di SQLite strftime('%Y-%W', ...) — settimane Monday-based.
  const inizio = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const offset = (inizio.getUTCDay() + 6) % 7;
  const primoLunedi = new Date(inizio);
  primoLunedi.setUTCDate(inizio.getUTCDate() + (offset === 0 ? 0 : 7 - offset));
  const settimane = Math.floor((d.getTime() - primoLunedi.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return `${d.getUTCFullYear()}-${String(Math.max(0, settimane + 1)).padStart(2, "0")}`;
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function parseData(data: string): Date {
  return new Date(`${data}T00:00:00Z`);
}

function contaPerSettimana(date: string[]): Map<string, number> {
  const mappa = new Map<string, number>();
  for (const d of date) {
    const chiave = weekKey(parseData(d));
    mappa.set(chiave, (mappa.get(chiave) ?? 0) + 1);
  }
  return mappa;
}

function contaPerMese(date: string[]): Map<string, number> {
  const mappa = new Map<string, number>();
  for (const d of date) {
    const chiave = monthKey(parseData(d));
    mappa.set(chiave, (mappa.get(chiave) ?? 0) + 1);
  }
  return mappa;
}

export async function sessioniProgrammatePerSettimana(db: D1Database): Promise<number> {
  const row = await db.prepare(`SELECT COUNT(*) AS n FROM sessioni_gruppo`).first<{ n: number }>();
  return row?.n ?? 0;
}

// Date (YYYY-MM-DD) di chiusura palestra / festività.
async function giorniChiusiSet(db: D1Database): Promise<Set<string>> {
  const { results } = await db.prepare(`SELECT data FROM giorni_chiusi`).all<{ data: string }>();
  return new Set(results.map((r) => r.data));
}

export type SessioneSettimana = {
  sessioneId: number;
  data: string;
  oraInizio: string;
  oraFine: string;
  confermata: boolean;
  // "indeciso" = nessuna scelta; "in_attesa" = ha prenotato, il coach non ha ancora fatto
  // l'appello; "presente"/"assente" = esito dell'appello del coach; "chiuso" = festività /
  // palestra chiusa, non conta negli anelli.
  stato: "presente" | "assente" | "in_attesa" | "indeciso" | "chiuso";
};

// Le 3 (o quante sono) sessioni di questa settimana con lo stato di presenza — per la
// checklist "Lunedì ✓ / Mercoledì / Venerdì" sotto l'anello Allenamenti in Home.
export async function sessioniSettimanaConStato(db: D1Database, userId: number): Promise<SessioneSettimana[]> {
  const inizio = inizioSettimana(adessoRoma());
  const { results: sessioni } = await db
    .prepare(`SELECT id, giorno_settimana AS giornoSettimana, ora_inizio AS oraInizio, ora_fine AS oraFine FROM sessioni_gruppo ORDER BY giorno_settimana`)
    .all<{ id: number; giornoSettimana: number; oraInizio: string; oraFine: string }>();

  const chiusi = await giorniChiusiSet(db);

  const risultato: SessioneSettimana[] = [];
  for (const s of sessioni) {
    const data = new Date(inizio);
    data.setUTCDate(data.getUTCDate() + (s.giornoSettimana - 1));
    const dataIso = data.toISOString().slice(0, 10);
    const [presenza, appello] = await Promise.all([
      db
        .prepare(`SELECT confermata, presenza_richiesta AS richiesta FROM presenze WHERE user_id = ? AND sessione_id = ? AND data = ?`)
        .bind(userId, s.id, dataIso)
        .first<{ confermata: number; richiesta: number }>(),
      db
        .prepare(`SELECT 1 FROM appello_conferme WHERE data = ? AND sessione_id = ?`)
        .bind(dataIso, s.id)
        .first(),
    ]);

    let stato: SessioneSettimana["stato"];
    if (chiusi.has(dataIso)) stato = "chiuso";
    else if (presenza == null) stato = "indeciso";
    else if (presenza.confermata) stato = "presente";
    else if (presenza.richiesta && !appello) stato = "in_attesa";
    else stato = "assente";

    risultato.push({
      sessioneId: s.id,
      data: dataIso,
      oraInizio: s.oraInizio,
      oraFine: s.oraFine,
      confermata: !!presenza?.confermata,
      stato,
    });
  }
  return risultato;
}

async function tutteLeDate(db: D1Database, sql: string, userId: number): Promise<string[]> {
  const { results } = await db.prepare(sql).bind(userId).all<{ data: string }>();
  return results.map((r) => r.data);
}

export type StatoAnelli = {
  training: { fatti: number; totali: number };
  challenges: { fatte: number; totali: number };
  feedback: { fatti: number; totali: number };
  settimanaCompletata: boolean;
  settimaneCompletateTotali: number;
};

export async function calcolaAnelli(db: D1Database, userId: number): Promise<StatoAnelli> {
  const oggi = adessoRoma();
  const chiaveSettCorrente = weekKey(oggi);
  const chiaveMeseCorrente = monthKey(oggi);

  const sessioniBase = await sessioniProgrammatePerSettimana(db);

  const [datePresenze, dateFeedback, dateSfide, quotaSfidePerMese, giorniSessione, dateChiuse] = await Promise.all([
    tutteLeDate(db, `SELECT data FROM presenze WHERE user_id = ? AND confermata = 1`, userId),
    tutteLeDate(db, `SELECT data FROM feedback_allenamento WHERE user_id = ?`, userId),
    tutteLeDate(db, `SELECT data FROM partecipazioni_sfide WHERE user_id = ?`, userId),
    sfidePerMesePubblicate(db),
    db.prepare(`SELECT DISTINCT giorno_settimana AS g FROM sessioni_gruppo`).all<{ g: number }>(),
    db.prepare(`SELECT data FROM giorni_chiusi`).all<{ data: string }>(),
  ]);

  // Chiusure che cadono su un giorno di sessione (lun/mer/ven): ognuna toglie una sessione
  // attesa a quella settimana → TRAINING e FEEDBACK diventano 2/2 invece di 3/3.
  const giorniConSessione = new Set(giorniSessione.results.map((r) => r.g));
  const dateChiuseSuSessione = dateChiuse.results
    .map((r) => r.data)
    .filter((d) => giorniConSessione.has(((new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7) + 1));
  const chiusurePerSett = contaPerSettimana(dateChiuseSuSessione);
  const sessioniAttese = (settimana: string) =>
    Math.max(0, sessioniBase - (chiusurePerSett.get(settimana) ?? 0));

  const presenzePerSett = contaPerSettimana(datePresenze);
  const feedbackPerSett = contaPerSettimana(dateFeedback);
  const sfidePerMese = contaPerMese(dateSfide);
  const quotaMese = (mese: string) => quotaSfidePerMese.get(mese) ?? 0;

  const attesaCorrente = sessioniAttese(chiaveSettCorrente);
  const trainingFattiCorrente = Math.min(presenzePerSett.get(chiaveSettCorrente) ?? 0, attesaCorrente);
  const feedbackFattiCorrente = Math.min(feedbackPerSett.get(chiaveSettCorrente) ?? 0, attesaCorrente);
  const challengesTotaliCorrente = quotaMese(chiaveMeseCorrente);
  const challengesFatteCorrente = Math.min(sfidePerMese.get(chiaveMeseCorrente) ?? 0, challengesTotaliCorrente);

  const meseDellaSettimana = (chiaveSettimana: string): string | null => {
    const data = datePresenze.find((d) => weekKey(parseData(d)) === chiaveSettimana);
    return data ? monthKey(inizioSettimana(parseData(data))) : null;
  };

  const settimaneChiuse = new Set<string>();
  for (const [settimana, presenze] of presenzePerSett) {
    const attese = sessioniAttese(settimana);
    if (attese === 0 || presenze < attese) continue; // TRAINING non chiuso
    const feedbackSett = feedbackPerSett.get(settimana) ?? 0;
    if (feedbackSett < attese) continue; // FEEDBACK non chiuso (serve 1 per sessione)
    const mese = meseDellaSettimana(settimana);
    const quotaMeseSett = mese ? quotaMese(mese) : 0;
    const challengesMese = mese ? (sfidePerMese.get(mese) ?? 0) : 0;
    // Un mese senza sfide non blocca la settimana; se ce ne sono, servono tutte.
    if (quotaMeseSett > 0 && challengesMese < quotaMeseSett) continue;
    settimaneChiuse.add(settimana);
  }

  return {
    training: { fatti: trainingFattiCorrente, totali: attesaCorrente },
    challenges: { fatte: challengesFatteCorrente, totali: challengesTotaliCorrente },
    feedback: { fatti: feedbackFattiCorrente, totali: attesaCorrente },
    settimanaCompletata: settimaneChiuse.has(chiaveSettCorrente),
    settimaneCompletateTotali: settimaneChiuse.size,
  };
}
