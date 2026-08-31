// Tutto il calcolo di date/orari "adesso" nel Worker passa da qui e usa il fuso di ROMA
// (Europe/Rome, con ora legale gestita da Intl). `adessoRoma()` restituisce un Date i cui
// campi UTC (getUTCHours, getUTCDate, toISOString...) contengono l'ora di Roma: così il
// resto del codice può continuare a usare i metodi `getUTC*` senza cambiare logica.
// NB: è un Date "spostato", non va confrontato con `Date.now()` o con istanti reali —
// solo con altri valori nello stesso frame (es. `${data}T${ora}:00Z` di orari salvati,
// che sono già ora di Roma).
export function adessoRoma(now: Date = new Date()): Date {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const g = (t: string) => Number(p.find((x) => x.type === t)?.value ?? "0");
  return new Date(Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second")));
}

export function oggi(): { data: string; giornoSettimana: number } {
  const now = adessoRoma();
  const data = now.toISOString().slice(0, 10);
  const giornoSettimana = ((now.getUTCDay() + 6) % 7) + 1; // 1=lunedì ... 7=domenica
  return { data, giornoSettimana };
}

// Mese di calendario precedente a "adesso" (il mese appena concluso) — usato dal
// questionario mensile.
export function mesePrecedente(now: Date = new Date()): { mese: number; anno: number } {
  const r = adessoRoma(now);
  const m = r.getUTCMonth(); // 0-11 = mese corrente; m (1-12) = mese precedente
  return m === 0 ? { mese: 12, anno: r.getUTCFullYear() - 1 } : { mese: m, anno: r.getUTCFullYear() };
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
