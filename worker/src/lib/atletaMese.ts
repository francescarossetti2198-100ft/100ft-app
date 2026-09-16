import type { Env } from "../types";
import { mesePrecedente } from "./oggi";
import { sendWebPush } from "./webPush";

const MESI = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];

// Stesso orario-check delle altre notifiche mensili (feedbackMensilePush.ts) — giorno 1,
// un orario diverso (09:00) per non ammucchiare tutto alle 10:00.
function oraRoma(): { giorno: number; oraMinuti: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { giorno: Number(get("day")), oraMinuti: `${get("hour")}:${get("minute")}` };
}

// Assegna "Atleta del mese" per il mese appena concluso — automatico, sui punti xp_log
// dello stesso periodo usato dalla classifica "Mese" (stessa fonte di verità, stesso
// filtro atleti attivi). A pari merito vincono tutti quelli col punteggio massimo. Se
// nessuno ha punti quel mese, nessun vincitore (niente da festeggiare). Il risultato resta
// per sempre in `atleta_del_mese` — uno storico che non cambia anche se i punti vengono poi
// corretti a mano.
//
// Novità presentata da ottobre 2026 (richiesta di Francesca): il 1° ottobre è la prima
// volta che questo cron scatta ed assegna il titolo — per il mese di SETTEMBRE appena
// concluso (non lo salta). Nessun guard aggiuntivo qui: il cron non può proprio girare
// prima del 1° ottobre, quindi la prima assegnazione avviene naturalmente in quel momento.
export async function assegnaAtletaDelMeseSeAttivo(env: Env): Promise<void> {
  const { giorno, oraMinuti } = oraRoma();
  if (giorno !== 1 || oraMinuti !== "09:00") return;

  const { mese, anno } = mesePrecedente();

  const gia = await env.DB.prepare(`SELECT 1 FROM atleta_del_mese WHERE mese = ? AND anno = ?`)
    .bind(mese, anno)
    .first();
  if (gia) return; // già assegnato per questo mese

  const inizio = `${anno}-${String(mese).padStart(2, "0")}-01`;
  const fine = `${anno}-${String(mese).padStart(2, "0")}-31`;

  const { results: classifica } = await env.DB.prepare(
    `SELECT u.id AS userId, COALESCE(SUM(x.xp_assegnati), 0) AS punti
     FROM users u
     LEFT JOIN xp_log x ON x.user_id = u.id AND x.data >= ? AND x.data <= ?
     WHERE u.role = 'atleta' AND u.status = 'attivo'
     GROUP BY u.id
     ORDER BY punti DESC`
  )
    .bind(inizio, fine)
    .all<{ userId: number; punti: number }>();

  const massimo = classifica[0]?.punti ?? 0;
  if (massimo <= 0) return; // nessuno ha fatto punti: nessun vincitore

  const vincitori = classifica.filter((r) => r.punti === massimo);

  await env.DB.batch(
    vincitori.map((v) =>
      env.DB.prepare(`INSERT INTO atleta_del_mese (mese, anno, user_id, punti) VALUES (?, ?, ?, ?)`).bind(
        mese,
        anno,
        v.userId,
        v.punti
      )
    )
  );

  // Un post nel Feed per ciascun vincitore (a pari merito, ognuno ha il suo momento).
  await env.DB.batch(
    vincitori.map((v) =>
      env.DB.prepare(
        `INSERT INTO post_feed (user_id, tipo, testo) VALUES (?, 'athlete_of_week', ?)`
      ).bind(v.userId, `${v.punti} punti in ${MESI[mese - 1]}`)
    )
  );

  // Push di congratulazioni ai soli vincitori.
  const { results: iscrizioni } = await env.DB.prepare(
    `SELECT id, user_id AS userId, endpoint, p256dh, auth FROM push_subscriptions
     WHERE user_id IN (${vincitori.map(() => "?").join(",")})`
  )
    .bind(...vincitori.map((v) => v.userId))
    .all<{ id: number; userId: number; endpoint: string; p256dh: string; auth: string }>();

  await Promise.all(
    iscrizioni.map(async (s) => {
      try {
        const res = await sendWebPush(
          { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
          env.VAPID_PUBLIC_KEY,
          env.VAPID_PRIVATE_KEY,
          { title: "🏆 100FT", body: `Sei l'Atleta del Mese di ${MESI[mese - 1]}! Congratulazioni 🎉`, url: "/sfide" },
          86400
        );
        if (res.status === 404 || res.status === 410) {
          await env.DB.prepare(`DELETE FROM push_subscriptions WHERE id = ?`).bind(s.id).run();
        }
      } catch {
        // un invio fallito non deve bloccare gli altri
      }
    })
  );
}
