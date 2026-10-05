import { awardXp } from "./xp";

// Bonus "settimana completa" (Francesca, set 2026): +10 punti a chi si allena lunedì,
// mercoledì e venerdì della stessa settimana. Come per l'anello TRAINING, i giorni in
// `giorni_chiusi` non contano: con una festività di mercoledì bastano lunedì + venerdì.
// Una riga xp_log per atleta per settimana (azione = 'settimana_completa_<lunedì>'), così
// si assegna una volta sola e si toglie se la coach corregge l'appello.
export const PUNTI_SETTIMANA_COMPLETA = 10;
// La regola vale da ottobre 2026: prima settimana piena = lunedì 5 ottobre.
const INIZIO_BONUS = "2026-10-05";
const GIORNI_SESSIONE = [1, 3, 5]; // lun, mer, ven

function lunediDi(data: string): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

function spostaGiorni(data: string, giorni: number): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + giorni);
  return d.toISOString().slice(0, 10);
}

export async function verificaBonusSettimana(db: D1Database, userId: number, data: string): Promise<void> {
  const lunedi = lunediDi(data);
  const giorni = GIORNI_SESSIONE.map((g) => spostaGiorni(lunedi, g - 1));
  if (lunedi < INIZIO_BONUS) return;
  const azione = `settimana_completa_${lunedi}`;

  const [chiusi, presenze, gia] = await Promise.all([
    db
      .prepare(`SELECT data FROM giorni_chiusi WHERE data IN (?, ?, ?)`)
      .bind(...giorni)
      .all<{ data: string }>(),
    db
      .prepare(
        `SELECT DISTINCT pr.data FROM presenze pr
         JOIN sessioni_gruppo sg ON sg.id = pr.sessione_id
         WHERE pr.user_id = ? AND pr.confermata = 1 AND pr.data IN (?, ?, ?)
           AND sg.giorno_settimana IN (1, 3, 5)`
      )
      .bind(userId, ...giorni)
      .all<{ data: string }>(),
    db.prepare(`SELECT id FROM xp_log WHERE user_id = ? AND azione = ? LIMIT 1`).bind(userId, azione).first(),
  ]);

  const chiusiSet = new Set(chiusi.results.map((r) => r.data));
  const presentiSet = new Set(presenze.results.map((r) => r.data));
  const aperti = giorni.filter((g) => !chiusiSet.has(g));
  const completa = aperti.length > 0 && aperti.every((g) => presentiSet.has(g));

  if (completa && !gia) {
    await awardXp(db, userId, azione, PUNTI_SETTIMANA_COMPLETA);
  } else if (!completa && gia) {
    await db.prepare(`DELETE FROM xp_log WHERE user_id = ? AND azione = ?`).bind(userId, azione).run();
  }
}
