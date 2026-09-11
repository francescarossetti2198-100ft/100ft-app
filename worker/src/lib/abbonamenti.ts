// Stato dell'abbonamento di un atleta, ricavato dal log append-only `abbonamenti_scelte`.
// Ogni riga = "da (dal_anno, dal_mese) l'atleta è sul piano X". Il piano di un mese M è la
// scelta con `dal` più recente <= M. Così una scelta futura "diventa attuale" da sola quando
// arriva il suo mese, senza cron.
import { adessoRoma } from "./oggi";

// Piano valido per l'atleta nel mese (anno, mese), o null se non ha mai scelto.
export async function pianoDelMese(
  db: D1Database,
  userId: number,
  anno: number,
  mese: number
): Promise<string | null> {
  const row = await db
    .prepare(
      `SELECT piano FROM abbonamenti_scelte
       WHERE user_id = ? AND (dal_anno < ? OR (dal_anno = ? AND dal_mese <= ?))
       ORDER BY dal_anno DESC, dal_mese DESC
       LIMIT 1`
    )
    .bind(userId, anno, anno, mese)
    .first<{ piano: string }>();
  return row?.piano ?? null;
}

// Piano che entrerà in vigore in un mese futuro (cambio già impostato dall'atleta), o null.
// Se la scelta futura coincide col piano attuale (es. cambio annullato) non è un vero
// cambio in sospeso -> null.
export async function pianoProssimo(db: D1Database, userId: number): Promise<string | null> {
  const ora = adessoRoma();
  const anno = ora.getUTCFullYear();
  const mese = ora.getUTCMonth() + 1;
  const row = await db
    .prepare(
      `SELECT piano FROM abbonamenti_scelte
       WHERE user_id = ? AND (dal_anno > ? OR (dal_anno = ? AND dal_mese > ?))
       ORDER BY dal_anno DESC, dal_mese DESC
       LIMIT 1`
    )
    .bind(userId, anno, anno, mese)
    .first<{ piano: string }>();
  if (!row) return null;
  const attuale = await pianoDelMese(db, userId, anno, mese);
  return row.piano === attuale ? null : row.piano;
}

// Mese successivo a "adesso" (ora di Roma).
export function meseProssimo(): { anno: number; mese: number } {
  const ora = adessoRoma();
  const m = ora.getUTCMonth() + 1; // 1-12
  return m === 12 ? { anno: ora.getUTCFullYear() + 1, mese: 1 } : { anno: ora.getUTCFullYear(), mese: m + 1 };
}
