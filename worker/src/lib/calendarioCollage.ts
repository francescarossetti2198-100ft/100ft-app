import type { Env } from "../types";
import { adessoRomaTesto } from "./suspense";
import { testoCasella } from "../routes/sfide";

// Calendario dell'Avvento (dic 2026): a `sfide.collage_dal` (ora di Roma) pubblica nel Feed
// principale, come post della coach, un collage per ogni casella con le foto di tutti quelli
// che l'hanno fatta (il disegno lo fa il frontend, il post porta solo sfida + casella).
// Le caselle senza foto si saltano. Gira dal cron ogni minuto, una volta sola per sfida.
// Idea di Francesca: "il 30 tutto insieme".
export async function pubblicaCollageCalendarioSeAttivo(env: Env): Promise<void> {
  const adesso = adessoRomaTesto();
  const { results: sfide } = await env.DB.prepare(
    `SELECT id, missioni, missioni_dal AS missioniDal FROM sfide
     WHERE missioni_dal IS NOT NULL AND collage_dal IS NOT NULL AND collage_dal <= ?
       AND collage_pubblicati = 0 AND solo_user_id IS NULL`
  )
    .bind(adesso)
    .all<{ id: number; missioni: string; missioniDal: string }>();

  for (const s of sfide) {
    // "Prenota" la pubblicazione: due giri del cron sovrapposti non la fanno due volte.
    const presa = await env.DB.prepare(`UPDATE sfide SET collage_pubblicati = 1 WHERE id = ? AND collage_pubblicati = 0`)
      .bind(s.id)
      .run();
    if ((presa.meta.changes ?? 0) === 0) continue;

    const missioni = JSON.parse(s.missioni) as string[];
    const dal = JSON.parse(s.missioniDal) as string[];
    const { results: conFoto } = await env.DB.prepare(
      `SELECT missione, COUNT(*) AS n FROM sfide_foto WHERE sfida_id = ? AND missione IS NOT NULL GROUP BY missione`
    )
      .bind(s.id)
      .all<{ missione: number; n: number }>();
    const quante = new Map(conFoto.map((r) => [r.missione, r.n]));

    // Feed in ordine di data decrescente: la prima casella (2 dicembre) deve stare in cima,
    // quindi le date dei post scendono di un secondo per casella.
    const base = Date.now();
    const stmt = missioni
      .map((m, i) => ({ m, i }))
      .filter(({ i }) => (quante.get(i) ?? 0) > 0)
      .map(({ m, i }) => {
        const data = new Date(base - i * 1000).toISOString().slice(0, 19).replace("T", " ");
        const n = quante.get(i) ?? 0;
        return env.DB.prepare(
          `INSERT INTO post_feed (user_id, tipo, testo, calendario, data) VALUES (NULL, 'annuncio_coach', ?, ?, ?)`
        ).bind(
          `${testoCasella(dal[i], m)}\nLe foto di tutti: ${n} ${n === 1 ? "partecipante" : "partecipanti"} 🎄`,
          JSON.stringify({ tipo: "collage", sfida: s.id, missione: i }),
          data
        );
      });
    if (stmt.length) await env.DB.batch(stmt);
  }
}
