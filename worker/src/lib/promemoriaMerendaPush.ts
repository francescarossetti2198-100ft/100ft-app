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

// Promemoria "fai merenda" — 1 ora e mezza prima dell'inizio dell'allenamento, solo nei
// giorni di allenamento (palestra aperta) e solo agli atleti che l'hanno attivato dal
// profilo (notifiche_preferenze.promemoria_merenda). Dedup per giorno.
export async function inviaPromemoriaMerendaSeAttivo(env: Env): Promise<void> {
  const { data, oraMinuti, giornoSettimana } = oraRoma();

  const sessione = await env.DB.prepare(
    `SELECT ora_inizio AS oraInizio FROM sessioni_gruppo WHERE giorno_settimana = ?`
  )
    .bind(giornoSettimana)
    .first<{ oraInizio: string }>();
  if (!sessione) return; // oggi non c'è allenamento

  const [h, m] = sessione.oraInizio.split(":").map(Number);
  const minutiPromemoria = h * 60 + m - 90;
  const orario = `${String(Math.floor(minutiPromemoria / 60)).padStart(2, "0")}:${String(minutiPromemoria % 60).padStart(2, "0")}`;
  if (oraMinuti !== orario) return;

  const chiuso = await env.DB.prepare(`SELECT 1 FROM giorni_chiusi WHERE data = ?`).bind(data).first();
  if (chiuso) return; // oggi la palestra è chiusa

  const inserito = await env.DB.prepare(`INSERT OR IGNORE INTO merenda_notifiche (data) VALUES (?)`)
    .bind(data)
    .run();
  if ((inserito.meta.changes ?? 0) === 0) return; // già inviato oggi

  const { results: iscrizioni } = await env.DB.prepare(
    `SELECT ps.id, ps.endpoint, ps.p256dh, ps.auth
     FROM push_subscriptions ps
     JOIN users u ON u.id = ps.user_id
     JOIN notifiche_preferenze np ON np.user_id = ps.user_id
     WHERE u.role = 'atleta' AND u.status = 'attivo' AND np.promemoria_merenda = 1`
  ).all<{ id: number; endpoint: string; p256dh: string; auth: string }>();

  await Promise.all(
    iscrizioni.map(async (s) => {
      try {
        const res = await sendWebPush(
          { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
          env.VAPID_PUBLIC_KEY,
          env.VAPID_PRIVATE_KEY,
          { title: "100FT — È ora della merenda 🍎", body: "Tra un'ora e mezza ti alleni: fai uno spuntino leggero.", url: "/" }
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
