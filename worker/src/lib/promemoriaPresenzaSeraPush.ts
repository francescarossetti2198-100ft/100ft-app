import type { Env } from "../types";
import { sendWebPush } from "./webPush";

// Data/ora "adesso" nel fuso di Roma — come in lib/promemoriaPush.ts (l'orario esatto conta).
function oraRoma(): { data: string; oraMinuti: string; giornoSettimana: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const data = `${get("year")}-${get("month")}-${get("day")}`;
  const oraMinuti = `${get("hour")}:${get("minute")}`;
  const giornoJs = new Date(`${data}T00:00:00Z`).getUTCDay(); // 0=domenica...6=sabato
  const giornoSettimana = giornoJs === 0 ? 7 : giornoJs; // 1=lunedì...7=domenica
  return { data, oraMinuti, giornoSettimana };
}

// Secondo promemoria della presenza, in aggiunta a quello delle 13:00 (lib/promemoriaPush.ts,
// che va a tutti): alle 17:00 dei giorni di allenamento, SOLO a chi non ha ancora risposto
// (nessuna riga in `presenze` per la sessione di oggi). Testo con il conteggio di chi si
// allena. Dedup per giorno (presenza_sera_notifiche).
export async function inviaPromemoriaPresenzaSeraSeAttivo(env: Env): Promise<void> {
  const { data, oraMinuti, giornoSettimana } = oraRoma();
  if (oraMinuti !== "17:00") return;

  const sessione = await env.DB.prepare(
    `SELECT id FROM sessioni_gruppo WHERE giorno_settimana = ? LIMIT 1`
  )
    .bind(giornoSettimana)
    .first<{ id: number }>();
  if (!sessione) return; // oggi non c'è allenamento

  const chiuso = await env.DB.prepare(`SELECT 1 FROM giorni_chiusi WHERE data = ?`).bind(data).first();
  if (chiuso) return; // oggi la palestra è chiusa

  const inserito = await env.DB.prepare(
    `INSERT OR IGNORE INTO presenza_sera_notifiche (data) VALUES (?)`
  )
    .bind(data)
    .run();
  if ((inserito.meta.changes ?? 0) === 0) return; // già inviato oggi

  // Quanti hanno già prenotato per oggi — entra nel testo del promemoria.
  const prenotati = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM presenze
     WHERE sessione_id = ? AND data = ? AND presenza_richiesta = 1`
  )
    .bind(sessione.id, data)
    .first<{ n: number }>();
  const n = prenotati?.n ?? 0;

  const body =
    n >= 2
      ? `Oggi in ${n} si allenano — ricordati di mettere la tua presenza 💪`
      : `Ti alleni oggi? Metti la tua presenza nell'app 💪`;

  // Destinatari: atleti attivi, iscritti alle push, senza NESSUNA riga presenze per la
  // sessione di oggi (chi ha già messo "presente" o "assente" ha risposto — niente sollecito).
  const { results: iscrizioni } = await env.DB.prepare(
    `SELECT ps.id, ps.endpoint, ps.p256dh, ps.auth
     FROM push_subscriptions ps
     JOIN users u ON u.id = ps.user_id
     WHERE u.role = 'atleta' AND u.status = 'attivo'
       AND NOT EXISTS (
         SELECT 1 FROM presenze p
         WHERE p.user_id = ps.user_id AND p.sessione_id = ? AND p.data = ?
       )`
  )
    .bind(sessione.id, data)
    .all<{ id: number; endpoint: string; p256dh: string; auth: string }>();

  await Promise.all(
    iscrizioni.map(async (s) => {
      try {
        const res = await sendWebPush(
          { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
          env.VAPID_PUBLIC_KEY,
          env.VAPID_PRIVATE_KEY,
          { title: "100FT — Ci sei oggi?", body, url: "/" }
        );
        if (res.status === 404 || res.status === 410) {
          await env.DB.prepare(`DELETE FROM push_subscriptions WHERE id = ?`).bind(s.id).run();
        }
      } catch {
        // Un singolo invio fallito non deve bloccare gli altri.
      }
    })
  );
}
