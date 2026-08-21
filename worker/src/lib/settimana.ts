// Anelli settimanali (brief, sezione 5 e mockup Home: "Questa settimana — Allenamenti/Sfide/Streak").
// "Settimana chiusa" = anello Allenamenti pieno (tutte le sessioni programmate confermate).
// L'anello Sfide è mostrato per fedeltà al mockup ma non è (ancora) richiesto per chiudere la
// settimana: il brief non definisce una quota sfide settimanale, quindi imporla renderebbe i
// livelli difficili da raggiungere nella pratica — da rivedere con Francesca insieme alle altre
// semplificazioni dichiarate.

function inizioSettimana(d: Date): Date {
  const copia = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const giorno = (copia.getUTCDay() + 6) % 7; // 0 = lunedì
  copia.setUTCDate(copia.getUTCDate() - giorno);
  return copia;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function weekKey(d: Date): string {
  // Stessa convenzione di SQLite strftime('%Y-%W', ...) — settimane Monday-based.
  const inizio = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const offset = (inizio.getUTCDay() + 6) % 7;
  const primoLunedi = new Date(inizio);
  primoLunedi.setUTCDate(inizio.getUTCDate() + (offset === 0 ? 0 : 7 - offset));
  const settimane = Math.floor((d.getTime() - primoLunedi.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return `${d.getUTCFullYear()}-${String(Math.max(0, settimane + 1)).padStart(2, "0")}`;
}

export async function sessioniProgrammatePerSettimana(db: D1Database): Promise<number> {
  const row = await db.prepare(`SELECT COUNT(*) AS n FROM sessioni_gruppo`).first<{ n: number }>();
  return row?.n ?? 0;
}

async function presenzePerSettimana(db: D1Database, userId: number): Promise<Map<string, number>> {
  const { results } = await db
    .prepare(
      `SELECT strftime('%Y-%W', data) AS settimana, COUNT(*) AS n
       FROM presenze WHERE user_id = ? AND confermata = 1
       GROUP BY settimana`
    )
    .bind(userId)
    .all<{ settimana: string; n: number }>();

  return new Map(results.map((r) => [r.settimana, r.n]));
}

export type StatoAnelli = {
  allenamenti: { fatti: number; totali: number };
  sfide: { fatte: number; totali: number };
  streakSettimane: number;
  settimaneChiuseTotali: number;
};

export async function calcolaAnelli(db: D1Database, userId: number): Promise<StatoAnelli> {
  const oggi = new Date();
  const inizioCorrente = inizioSettimana(oggi);
  const fineCorrente = new Date(inizioCorrente);
  fineCorrente.setUTCDate(fineCorrente.getUTCDate() + 6);

  const sessioniPerSettimana = await sessioniProgrammatePerSettimana(db);
  const presenzePerSett = await presenzePerSettimana(db, userId);

  const chiaveCorrente = weekKey(oggi);
  const allenamentiFatti = presenzePerSett.get(chiaveCorrente) ?? 0;

  const [sfideAttiveRow, sfideCompletateRow] = await Promise.all([
    db
      .prepare(`SELECT COUNT(*) AS n FROM sfide WHERE data_inizio <= ? AND data_fine >= ?`)
      .bind(isoDate(fineCorrente), isoDate(inizioCorrente))
      .first<{ n: number }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM partecipazioni_sfide
         WHERE user_id = ? AND data >= ? AND data <= ?`
      )
      .bind(userId, isoDate(inizioCorrente), isoDate(fineCorrente))
      .first<{ n: number }>(),
  ]);

  // Settimane "chiuse" = almeno quante sessioni sono programmate ogni settimana.
  const settimaneChiuse = new Set(
    [...presenzePerSett.entries()].filter(([, n]) => n >= sessioniPerSettimana).map(([k]) => k)
  );

  let cursor = new Date(inizioCorrente);
  if (!settimaneChiuse.has(weekKey(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 7);
  }
  let streakSettimane = 0;
  while (settimaneChiuse.has(weekKey(cursor))) {
    streakSettimane++;
    cursor.setUTCDate(cursor.getUTCDate() - 7);
  }

  return {
    allenamenti: { fatti: Math.min(allenamentiFatti, sessioniPerSettimana), totali: sessioniPerSettimana },
    sfide: { fatte: sfideCompletateRow?.n ?? 0, totali: sfideAttiveRow?.n ?? 0 },
    streakSettimane,
    settimaneChiuseTotali: settimaneChiuse.size,
  };
}
