import type { Env } from "../types";
import { mezzanotteRomaUtc } from "./oggi";
import { adessoRomaTesto } from "./suspense";
import { sendWebPush } from "./webPush";

// Sfide foto con votazione (migrazione 0051, prima: Halloween ottobre 2026). Fasi, con gli
// orari della sfida (ora di Roma, "YYYY-MM-DD HH:MM"):
//   caricamento  → fino a votazione_dal: si carica la foto (+punti della sfida), ma è segreta
//   voto         → votazione_dal … votazione_fino: si vedono tutte le foto e si vota
//   attesa       → votazione_fino … risultati_dal: votazione chiusa, risultato in arrivo
//   risultati    → da risultati_dal: la più votata ha preso punti_vincitore in più
export type FaseVotazione = "caricamento" | "voto" | "attesa" | "risultati";

export type OrariVotazione = {
  votazione_dal: string | null;
  votazione_fino: string | null;
  risultati_dal: string | null;
};

export function faseVotazione(s: OrariVotazione, adesso = adessoRomaTesto()): FaseVotazione | null {
  if (!s.votazione_dal || !s.votazione_fino || !s.risultati_dal) return null;
  if (adesso < s.votazione_dal) return "caricamento";
  if (adesso < s.votazione_fino) return "voto";
  if (adesso < s.risultati_dal) return "attesa";
  return "risultati";
}

// "YYYY-MM-DD HH:MM" di Roma → istante UTC nel formato di xp_log.data.
function romaTestoAUtc(t: string): string {
  const [a, m, g] = t.slice(0, 10).split("-").map(Number);
  const [h, min] = t.slice(11, 16).split(":").map(Number);
  const mezzanotte = new Date(`${mezzanotteRomaUtc(a, m, g).replace(" ", "T")}Z`);
  return new Date(mezzanotte.getTime() + (h * 60 + min) * 60_000).toISOString().slice(0, 19).replace("T", " ");
}

// Assegna i punti alla foto più votata delle sfide arrivate a risultati_dal. Gira dal cron
// ogni minuto, PRIMA dell'Atleta del mese (index.ts), così i punti della vincitrice contano
// già. I punti sono datati un secondo prima della fine della votazione: restano nel mese
// della sfida anche se il risultato esce il 1° del mese dopo.
export async function chiudiVotazioniScadute(env: Env): Promise<void> {
  const adesso = adessoRomaTesto();
  const { results: daChiudere } = await env.DB.prepare(
    `SELECT id, titolo, punti_vincitore AS puntiVincitore, votazione_fino AS votazioneFino FROM sfide
     WHERE votazione_chiusa = 0 AND risultati_dal IS NOT NULL AND risultati_dal <= ?`
  )
    .bind(adesso)
    .all<{ id: number; titolo: string; puntiVincitore: number; votazioneFino: string }>();

  for (const s of daChiudere) {
    // "Prenota" la chiusura: se due giri del cron si sovrappongono, solo uno assegna i punti.
    const presa = await env.DB.prepare(`UPDATE sfide SET votazione_chiusa = 1 WHERE id = ? AND votazione_chiusa = 0`)
      .bind(s.id)
      .run();
    if ((presa.meta.changes ?? 0) === 0) continue;

    // Contano solo i voti a chi ha davvero partecipato (con la foto).
    const { results: conteggi } = await env.DB.prepare(
      `SELECT v.votato_id AS userId, COUNT(*) AS voti, p.foto_url AS fotoUrl
       FROM voti_sfide v
       JOIN partecipazioni_sfide p ON p.sfida_id = v.sfida_id AND p.user_id = v.votato_id
       WHERE v.sfida_id = ?
       GROUP BY v.votato_id
       ORDER BY voti DESC`
    )
      .bind(s.id)
      .all<{ userId: number; voti: number; fotoUrl: string | null }>();

    const massimo = conteggi[0]?.voti ?? 0;
    if (massimo <= 0 || s.puntiVincitore <= 0) continue; // nessun voto: nessuna vincitrice
    const vincitrici = conteggi.filter((r) => r.voti === massimo);

    const dataPunti = romaTestoAUtc(s.votazioneFino);
    const quando = new Date(`${dataPunti.replace(" ", "T")}Z`);
    const dataPuntiPrima = new Date(quando.getTime() - 1000).toISOString().slice(0, 19).replace("T", " ");

    await env.DB.batch(
      vincitrici.flatMap((v) => [
        env.DB.prepare(
          `INSERT INTO xp_log (user_id, azione, xp_assegnati, sfida_id, motivo, data) VALUES (?, 'sfida_vincitrice', ?, ?, ?, ?)`
        ).bind(v.userId, s.puntiVincitore, s.id, s.titolo, dataPuntiPrima),
        env.DB.prepare(`INSERT INTO post_feed (user_id, tipo, contenuto_url, testo) VALUES (?, 'sfida', ?, ?)`).bind(
          v.userId,
          v.fotoUrl,
          `🏆 Foto più votata · ${s.titolo} (${v.voti} ${v.voti === 1 ? "voto" : "voti"})`
        ),
      ])
    );

    const { results: iscrizioni } = await env.DB.prepare(
      `SELECT id, endpoint, p256dh, auth FROM push_subscriptions
       WHERE user_id IN (${vincitrici.map(() => "?").join(",")})`
    )
      .bind(...vincitrici.map((v) => v.userId))
      .all<{ id: number; endpoint: string; p256dh: string; auth: string }>();

    await Promise.all(
      iscrizioni.map(async (i) => {
        try {
          const res = await sendWebPush(
            { endpoint: i.endpoint, p256dh: i.p256dh, auth: i.auth },
            env.VAPID_PUBLIC_KEY,
            env.VAPID_PRIVATE_KEY,
            { title: "🏆 100FT", body: `La tua foto è la più votata di «${s.titolo}»! +${s.puntiVincitore} punti 🎉`, url: "/sfide" },
            86400
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
