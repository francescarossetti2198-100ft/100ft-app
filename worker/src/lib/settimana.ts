// "YOUR WEEK" — i 3 anelli della Home: TRAINING / CHALLENGES / FEEDBACK.
// Sostituisce il vecchio sistema (Allenamenti/Sfide/Streak): lo "streak" a settimane
// consecutive è stato eliminato su richiesta esplicita — le settimane completate sono
// cumulative, non un filotto che si azzera se ne salti una.
//
// - TRAINING: presenze confermate questa settimana / sessioni programmate questa settimana.
// - CHALLENGES: sfide completate questo MESE / quota mensile (QUOTA_SFIDE_MESE sotto —
//   provvisoria finché non sarà configurabile dal coach, come la probabilità del Daily Drop).
//   Basato sul numero di sfide, non sui punti XP (sistema separato).
// - FEEDBACK: feedback dati questa settimana / sessioni EFFETTIVAMENTE frequentate questa
//   settimana — chi non si allena non viene penalizzato sul denominatore.
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

export const QUOTA_SFIDE_MESE = 4; // provvisorio, andrebbe reso configurabile dal coach

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

export type SessioneSettimana = {
  sessioneId: number;
  data: string;
  oraInizio: string;
  oraFine: string;
  confermata: boolean;
  // "indeciso" = nessuna scelta ancora fatta; "assente" = ha segnato esplicitamente assenza.
  stato: "presente" | "assente" | "indeciso";
};

// Le 3 (o quante sono) sessioni di questa settimana con lo stato di presenza — per la
// checklist "Lunedì ✓ / Mercoledì / Venerdì" sotto l'anello Allenamenti in Home.
export async function sessioniSettimanaConStato(db: D1Database, userId: number): Promise<SessioneSettimana[]> {
  const inizio = inizioSettimana(new Date());
  const { results: sessioni } = await db
    .prepare(`SELECT id, giorno_settimana AS giornoSettimana, ora_inizio AS oraInizio, ora_fine AS oraFine FROM sessioni_gruppo ORDER BY giorno_settimana`)
    .all<{ id: number; giornoSettimana: number; oraInizio: string; oraFine: string }>();

  const risultato: SessioneSettimana[] = [];
  for (const s of sessioni) {
    const data = new Date(inizio);
    data.setUTCDate(data.getUTCDate() + (s.giornoSettimana - 1));
    const dataIso = data.toISOString().slice(0, 10);
    const presenza = await db
      .prepare(`SELECT confermata FROM presenze WHERE user_id = ? AND sessione_id = ? AND data = ?`)
      .bind(userId, s.id, dataIso)
      .first<{ confermata: number }>();
    const stato = presenza == null ? "indeciso" : presenza.confermata ? "presente" : "assente";
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
  const oggi = new Date();
  const chiaveSettCorrente = weekKey(oggi);
  const chiaveMeseCorrente = monthKey(oggi);

  const sessioniPerSettimana = await sessioniProgrammatePerSettimana(db);

  const [datePresenze, dateFeedback, dateSfide] = await Promise.all([
    tutteLeDate(db, `SELECT data FROM presenze WHERE user_id = ? AND confermata = 1`, userId),
    tutteLeDate(db, `SELECT data FROM feedback_allenamento WHERE user_id = ?`, userId),
    tutteLeDate(db, `SELECT data FROM partecipazioni_sfide WHERE user_id = ?`, userId),
  ]);

  const presenzePerSett = contaPerSettimana(datePresenze);
  const feedbackPerSett = contaPerSettimana(dateFeedback);
  const sfidePerMese = contaPerMese(dateSfide);

  const trainingFattiCorrente = Math.min(presenzePerSett.get(chiaveSettCorrente) ?? 0, sessioniPerSettimana);
  const feedbackTotaliCorrente = presenzePerSett.get(chiaveSettCorrente) ?? 0;
  const feedbackFattiCorrente = Math.min(feedbackPerSett.get(chiaveSettCorrente) ?? 0, feedbackTotaliCorrente);
  const challengesFatteCorrente = sfidePerMese.get(chiaveMeseCorrente) ?? 0;

  const meseDellaSettimana = (chiaveSettimana: string): string | null => {
    const data = datePresenze.find((d) => weekKey(parseData(d)) === chiaveSettimana);
    return data ? monthKey(inizioSettimana(parseData(data))) : null;
  };

  const settimaneChiuse = new Set<string>();
  for (const [settimana, presenze] of presenzePerSett) {
    if (presenze < sessioniPerSettimana) continue; // TRAINING non chiuso
    const feedbackSett = feedbackPerSett.get(settimana) ?? 0;
    if (feedbackSett < presenze) continue; // FEEDBACK non completo sulle sessioni frequentate
    const mese = meseDellaSettimana(settimana);
    const challengesMese = mese ? (sfidePerMese.get(mese) ?? 0) : 0;
    if (challengesMese < QUOTA_SFIDE_MESE) continue; // CHALLENGES non chiuso quel mese
    settimaneChiuse.add(settimana);
  }

  return {
    training: { fatti: trainingFattiCorrente, totali: sessioniPerSettimana },
    challenges: { fatte: Math.min(challengesFatteCorrente, QUOTA_SFIDE_MESE), totali: QUOTA_SFIDE_MESE },
    feedback: { fatti: feedbackFattiCorrente, totali: feedbackTotaliCorrente },
    settimanaCompletata: settimaneChiuse.has(chiaveSettCorrente),
    settimaneCompletateTotali: settimaneChiuse.size,
  };
}
