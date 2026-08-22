// Orario del Daily Drop (brief, sezione 8): solo lun/mer/ven (giorni di allenamento),
// a un orario casuale ma MAI durante la sessione. L'orario è "casuale" nel senso che
// sembra imprevedibile, ma è in realtà deterministico — derivato da un hash della data —
// così l'endpoint può rispondere in modo coerente per tutta la giornata senza dover
// salvare nulla su un cron/Durable Object (che restano comunque necessari per la vera
// notifica push, non ancora costruita — vedi nota in routes/daily-drop.ts).
const INIZIO_GIORNO_MIN = 8 * 60; // 08:00
const FINE_GIORNO_MIN = 22 * 60; // 22:00

function fasciaAllenamento(giornoSettimana: number): { inizio: number; fine: number } | null {
  if (giornoSettimana === 1 || giornoSettimana === 3) return { inizio: 19 * 60 + 30, fine: 20 * 60 + 30 }; // lun/mer 19:30-20:30
  if (giornoSettimana === 5) return { inizio: 19 * 60, fine: 20 * 60 }; // ven 19:00-20:00
  return null;
}

function seedDaData(data: string): number {
  let h = 0;
  for (let i = 0; i < data.length; i++) h = (Math.imul(h, 31) + data.charCodeAt(i)) >>> 0;
  return h;
}

// mulberry32 — PRNG minimale, deterministico dato lo stesso seed.
function random01(seed: number): number {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Minuti dalla mezzanotte in cui "scatta" il Daily Drop per questa data, o null se il
// giorno non è un giorno di allenamento (il Daily Drop non è previsto).
export function orarioDailyDrop(data: string, giornoSettimana: number): number | null {
  const fascia = fasciaAllenamento(giornoSettimana);
  if (!fascia) return null;

  const disponibili = FINE_GIORNO_MIN - INIZIO_GIORNO_MIN - (fascia.fine - fascia.inizio);
  const offset = Math.floor(random01(seedDaData(data)) * disponibili);
  let minuti = INIZIO_GIORNO_MIN + offset;
  if (minuti >= fascia.inizio) minuti += fascia.fine - fascia.inizio; // salta la fascia di allenamento

  return minuti;
}

export function minutiOra(now: Date): number {
  return now.getUTCHours() * 60 + now.getUTCMinutes();
}
