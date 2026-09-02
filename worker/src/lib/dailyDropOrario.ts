import { adessoRoma } from "./oggi";

// Orario del Daily Drop (brief, sezione 8): solo nei giorni di allenamento (lun/mer/ven),
// ma non ogni volta — è occasionale ("non per forza tutti i giorni, è una tantum"). Quando
// capita, è alla stessa ora per tutti (nessuna variazione per singolo atleta). L'orario è
// "casuale" nel senso che sembra imprevedibile, ma è in realtà deterministico — derivato da
// un hash della data — così l'endpoint risponde in modo coerente per tutta la giornata senza
// dover salvare nulla su un cron/Durable Object (che restano comunque necessari per la vera
// notifica push, non ancora costruita — vedi nota in routes/daily-drop.ts).
const INIZIO_GIORNO_MIN = 8 * 60; // 08:00
const FINE_GIORNO_MIN = 22 * 60; // 22:00

// Probabilità che un giorno di allenamento abbia un Daily Drop — circa 1 su 3 giorni
// idonei (grosso modo una volta a settimana). Valore scelto in assenza di indicazioni
// più precise; andrebbe reso configurabile dal coach quando esisterà la Coach Dashboard.
const PROBABILITA_GIORNO = 0.35;

// Quanto resta valida la possibilità di rispondere, da quando scatta l'orario (= da quando
// parte la notifica push, vedi lib/dailyDropPush.ts): una finestra breve e stretta, non
// tutto il giorno — dopo questi minuti la possibilità di rispondere sparisce.
export const FINESTRA_RISPOSTA_MIN = 5;

function fasciaAllenamento(giornoSettimana: number): { inizio: number; fine: number } | null {
  if (giornoSettimana === 1 || giornoSettimana === 3) return { inizio: 19 * 60 + 30, fine: 20 * 60 + 30 }; // lun/mer 19:30-20:30
  if (giornoSettimana === 5) return { inizio: 19 * 60, fine: 20 * 60 }; // ven 19:00-20:00
  return null;
}

// Orari del promemoria "bevi un po' d'acqua" (lib/promemoriaAcquaPush.ts, ORARI) — il Daily
// Drop non deve mai scattare vicino a questi orari, altrimenti arrivano due notifiche
// "bevi acqua" quasi insieme. ⚠️ Tenere allineato a quel file.
const ORARI_ACQUA_MIN = [11 * 60, 16 * 60];
const MARGINE_ACQUA_MIN = 20;

// Tutte le fasce da evitare per un dato giorno, in ordine — la sessione di allenamento più
// le due finestre attorno ai promemoria acqua.
function fasceEscluse(giornoSettimana: number): { inizio: number; fine: number }[] {
  const escluse = ORARI_ACQUA_MIN.map((m) => ({ inizio: m - MARGINE_ACQUA_MIN, fine: m + MARGINE_ACQUA_MIN }));
  const fascia = fasciaAllenamento(giornoSettimana);
  if (fascia) escluse.push(fascia);
  return escluse.sort((a, b) => a.inizio - b.inizio);
}

function seedDaData(data: string): number {
  let h = 0;
  for (let i = 0; i < data.length; i++) h = (Math.imul(h, 31) + data.charCodeAt(i)) >>> 0;
  return h;
}

// mulberry32 — PRNG minimale, deterministico dato lo stesso seed. Restituisce un generatore
// con stato interno, così due chiamate successive danno numeri diversi ma riproducibili.
function creaGeneratore(seed: number): () => number {
  let stato = seed;
  return () => {
    stato |= 0;
    stato = (stato + 0x6d2b79f5) | 0;
    let t = Math.imul(stato ^ (stato >>> 15), 1 | stato);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Minuti dalla mezzanotte in cui "scatta" il Daily Drop per questa data, o null se oggi
// non è previsto (non è un giorno di allenamento, oppure è un giorno di allenamento ma
// questa volta "non tocca" — occasionale, non ogni sessione).
export function orarioDailyDrop(data: string, giornoSettimana: number): number | null {
  const fascia = fasciaAllenamento(giornoSettimana);
  if (!fascia) return null;

  const random = creaGeneratore(seedDaData(data));
  if (random() >= PROBABILITA_GIORNO) return null;

  const escluse = fasceEscluse(giornoSettimana);
  const minutiEsclusi = escluse.reduce((tot, f) => tot + (f.fine - f.inizio), 0);
  const disponibili = FINE_GIORNO_MIN - INIZIO_GIORNO_MIN - minutiEsclusi;
  const offset = Math.floor(random() * disponibili);

  let minuti = INIZIO_GIORNO_MIN + offset;
  for (const f of escluse) {
    if (minuti >= f.inizio) minuti += f.fine - f.inizio; // salta questa fascia (allenamento o promemoria acqua)
  }

  return minuti;
}

export function minutiOra(now: Date = adessoRoma()): number {
  return now.getUTCHours() * 60 + now.getUTCMinutes();
}

// Stato del Daily Drop di oggi in un colpo solo: previsto (giorno + "tocca" oggi), attivo
// (dentro la finestra di FINESTRA_RISPOSTA_MIN minuti da quando è scattato) o scaduto
// (finestra chiusa, non si può più rispondere). Non rivela mai l'orario esatto prima che
// scatti — l'endpoint dice solo previsto/attivo/scaduto, mai il minuto esatto.
export function statoDailyDrop(
  data: string,
  giornoSettimana: number,
  ora: number = minutiOra()
): { previsto: boolean; attivo: boolean; scaduto: boolean } {
  const orarioScatto = orarioDailyDrop(data, giornoSettimana);
  if (orarioScatto === null) return { previsto: false, attivo: false, scaduto: false };

  const attivo = ora >= orarioScatto && ora < orarioScatto + FINESTRA_RISPOSTA_MIN;
  const scaduto = ora >= orarioScatto + FINESTRA_RISPOSTA_MIN;
  return { previsto: true, attivo, scaduto };
}
