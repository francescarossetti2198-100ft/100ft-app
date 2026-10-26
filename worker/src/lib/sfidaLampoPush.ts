import type { Env } from "../types";
import { adessoRomaTesto } from "./suspense";
import { sendWebPush } from "./webPush";

// Push a tutti gli atleti quando si apre una sfida lampo (richiesta di Francesca, ott 2026):
// dal giorno di data_inizio, non prima delle 09:30 (come il Daily Drop). Nella campanella
// la sfida compare già da sola (lib/notifiche.ts, "Nuova sfida lampo"). Una volta sola per
// sfida (`push_lampo_inviata`), anche se il cron gira ogni minuto.
const ORA_PUSH = "09:30";

export async function inviaPushSfidaLampoSeAttivo(env: Env): Promise<void> {
  const adesso = adessoRomaTesto();
  if (adesso.slice(11) < ORA_PUSH) return;
  const oggi = adesso.slice(0, 10);

  const { results: sfide } = await env.DB.prepare(
    `SELECT id, titolo FROM sfide
     WHERE flash = 1 AND push_lampo_inviata = 0 AND data_inizio <= ? AND data_fine >= ?`
  )
    .bind(oggi, oggi)
    .all<{ id: number; titolo: string }>();

  for (const s of sfide) {
    const presa = await env.DB.prepare(`UPDATE sfide SET push_lampo_inviata = 1 WHERE id = ? AND push_lampo_inviata = 0`)
      .bind(s.id)
      .run();
    if ((presa.meta.changes ?? 0) === 0) continue;

    const { results: iscrizioni } = await env.DB.prepare(
      `SELECT ps.id, ps.endpoint, ps.p256dh, ps.auth FROM push_subscriptions ps
       JOIN users u ON u.id = ps.user_id
       WHERE u.role = 'atleta' AND u.status = 'attivo'`
    ).all<{ id: number; endpoint: string; p256dh: string; auth: string }>();

    await Promise.all(
      iscrizioni.map(async (i) => {
        try {
          const res = await sendWebPush(
            { endpoint: i.endpoint, p256dh: i.p256dh, auth: i.auth },
            env.VAPID_PUBLIC_KEY,
            env.VAPID_PRIVATE_KEY,
            { title: "⚡ Sfida lampo!", body: s.titolo, url: "/sfide" },
            43200
          );
          if (res.status === 404 || res.status === 410) {
            await env.DB.prepare(`DELETE FROM push_subscriptions WHERE id = ?`).bind(i.id).run();
          }
        } catch {
          // un invio fallito non deve bloccare gli altri
        }
      })
    );
  }
}
