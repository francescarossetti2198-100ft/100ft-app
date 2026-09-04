import type { Env } from "../types";
import { sendWebPush } from "./webPush";

// Data/ora "adesso" nel fuso di Roma — come in lib/promemoriaPush.ts (l'orario esatto conta:
// sbagliare fuso vorrebbe dire mandare il promemoria 1-2 ore fuori).
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

// Promemoria del feedback post-allenamento — alle 21:00 (ora di Roma) dei giorni di
// allenamento (lun/mer/ven), a chi ha partecipato alla sessione di oggi ma non ha ancora
// lasciato il feedback. Il feedback scade a mezzanotte, quindi questa è l'ultima chiamata.
// Dedup per giorno (feedback_promemoria_notifiche).
export async function inviaPromemoriaFeedbackSeAttivo(env: Env): Promise<void> {
  const { data, oraMinuti, giornoSettimana } = oraRoma();
  if (oraMinuti !== "21:00") return;

  const sessione = await env.DB.prepare(
    `SELECT 1 FROM sessioni_gruppo WHERE giorno_settimana = ? LIMIT 1`
  )
    .bind(giornoSettimana)
    .first();
  if (!sessione) return; // oggi non c'è allenamento

  const chiuso = await env.DB.prepare(`SELECT 1 FROM giorni_chiusi WHERE data = ?`).bind(data).first();
  if (chiuso) return; // oggi la palestra è chiusa

  const inserito = await env.DB.prepare(
    `INSERT OR IGNORE INTO feedback_promemoria_notifiche (data) VALUES (?)`
  )
    .bind(data)
    .run();
  if ((inserito.meta.changes ?? 0) === 0) return; // già inviato oggi

  // Destinatari: atleti attivi, iscritti alle push, con una presenza prenotata oggi e
  // nessun feedback per quella sessione (stessa condizione di GET /feedback/da-dare).
  const { results: iscrizioni } = await env.DB.prepare(
    `SELECT ps.id, ps.endpoint, ps.p256dh, ps.auth
     FROM push_subscriptions ps
     JOIN users u ON u.id = ps.user_id
     JOIN presenze p ON p.user_id = ps.user_id AND p.data = ? AND p.presenza_richiesta = 1
     WHERE u.role = 'atleta' AND u.status = 'attivo'
       AND NOT EXISTS (
         SELECT 1 FROM feedback_allenamento f
         WHERE f.user_id = p.user_id AND f.sessione_id = p.sessione_id AND f.data = p.data
       )`
  )
    .bind(data)
    .all<{ id: number; endpoint: string; p256dh: string; auth: string }>();

  await Promise.all(
    iscrizioni.map(async (s) => {
      try {
        const res = await sendWebPush(
          { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
          env.VAPID_PUBLIC_KEY,
          env.VAPID_PRIVATE_KEY,
          {
            title: "100FT — Com'è andato l'allenamento?",
            body: "Lascia il feedback prima di mezzanotte: bastano 30 secondi 💬",
            url: "/",
          }
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
