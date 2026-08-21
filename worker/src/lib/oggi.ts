// Nota: giorno/data calcolati sull'ora del Worker (UTC), non sul fuso di Roma —
// da rivedere se il disallineamento vicino a mezzanotte diventa un problema reale.
export function oggi(): { data: string; giornoSettimana: number } {
  const now = new Date();
  const data = now.toISOString().slice(0, 10);
  const giornoSettimana = ((now.getUTCDay() + 6) % 7) + 1; // 1=lunedì ... 7=domenica
  return { data, giornoSettimana };
}

export type SessioneOggi = { id: number; ora_inizio: string; ora_fine: string; tipo_sessione: string };

export async function sessioneOggi(db: D1Database): Promise<SessioneOggi | null> {
  const { giornoSettimana } = oggi();
  const sessione = await db
    .prepare(`SELECT id, ora_inizio, ora_fine, tipo_sessione FROM sessioni_gruppo WHERE giorno_settimana = ?`)
    .bind(giornoSettimana)
    .first<SessioneOggi>();
  return sessione ?? null;
}
