import { awardXp } from "./xp";

// Bonus "settimana completa" (Francesca, set 2026): +10 punti a chi si allena lunedì,
// mercoledì e venerdì della stessa settimana. Come per l'anello TRAINING, i giorni in
// `giorni_chiusi` non contano: con una festività di mercoledì bastano lunedì + venerdì.
// Dal 30/10/2026 vale UNA volta al mese (la prima settimana completa), non ogni settimana:
// darlo a ogni settimana sbilanciava troppo la classifica contro chi viene meno spesso.
// Il mese è quello del lunedì. Una riga xp_log per atleta per mese (azione =
// 'settimana_completa_<lunedì>'), così si toglie se la coach corregge l'appello e passa a
// un'altra settimana completa dello stesso mese, se c'è.
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

async function settimanaCompleta(db: D1Database, userId: number, lunedi: string): Promise<boolean> {
  const giorni = GIORNI_SESSIONE.map((g) => spostaGiorni(lunedi, g - 1));
  const [chiusi, presenze] = await Promise.all([
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
  ]);
  const chiusiSet = new Set(chiusi.results.map((r) => r.data));
  const presentiSet = new Set(presenze.results.map((r) => r.data));
  const aperti = giorni.filter((g) => !chiusiSet.has(g));
  return aperti.length > 0 && aperti.every((g) => presentiSet.has(g));
}

// I lunedì del mese di `lunedi`, dal primo all'ultimo.
function lunediDelMese(lunedi: string): string[] {
  const mese = lunedi.slice(0, 7);
  let d = lunedi;
  while (spostaGiorni(d, -7).slice(0, 7) === mese) d = spostaGiorni(d, -7);
  const elenco: string[] = [];
  for (; d.slice(0, 7) === mese; d = spostaGiorni(d, 7)) elenco.push(d);
  return elenco;
}

export async function verificaBonusSettimana(db: D1Database, userId: number, data: string): Promise<void> {
  const lunedi = lunediDi(data);
  if (lunedi < INIZIO_BONUS) return;
  const azione = `settimana_completa_${lunedi}`;

  const [completa, gia] = await Promise.all([
    settimanaCompleta(db, userId, lunedi),
    db
      .prepare(`SELECT azione FROM xp_log WHERE user_id = ? AND azione LIKE ? LIMIT 1`)
      .bind(userId, `settimana_completa_${lunedi.slice(0, 7)}-%`)
      .first<{ azione: string }>(),
  ]);

  if (completa && !gia) {
    await awardXp(db, userId, azione, PUNTI_SETTIMANA_COMPLETA);
  } else if (!completa && gia?.azione === azione) {
    // La settimana col bonus non è più completa: si toglie e, se nello stesso mese c'è
    // un'altra settimana completa, passa a quella.
    await db.prepare(`DELETE FROM xp_log WHERE user_id = ? AND azione = ?`).bind(userId, azione).run();
    for (const altro of lunediDelMese(lunedi)) {
      if (altro === lunedi || altro < INIZIO_BONUS) continue;
      if (await settimanaCompleta(db, userId, altro)) {
        await awardXp(db, userId, `settimana_completa_${altro}`, PUNTI_SETTIMANA_COMPLETA);
        break;
      }
    }
  }
}
