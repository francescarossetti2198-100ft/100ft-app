import { giornoRomaUtc, mezzanotteRomaUtc, adessoRoma } from "./oggi";

// Sfide extra "rispondi a questi Daily Drop" (sfide_extra.criterio =
// 'daily_drop_date:2026-12-25,2027-01-01', dic 2026: Natale + Capodanno). Si completa da sola
// quando l'atleta ha risposto al Daily Drop di TUTTE quelle date (giorni di Roma). Una volta
// sola: partecipazione + punti + post nel Feed. Gira subito dopo una risposta al Daily Drop.
// I punti restano nel mese della sfida extra anche se l'ultima data cade dopo (Capodanno =
// 1° gennaio): sono datati all'ultimo secondo di quel mese.
export async function verificaExtraDailyDrop(db: D1Database, userId: number, data: string): Promise<void> {
  const { results: extra } = await db
    .prepare(
      `SELECT id, anno, mese, titolo, punti, criterio FROM sfide_extra
       WHERE criterio LIKE 'daily_drop_date:%' AND criterio LIKE ?`
    )
    .bind(`%${data}%`)
    .all<{ id: number; anno: number; mese: number; titolo: string; punti: number | null; criterio: string }>();

  for (const s of extra) {
    const date = s.criterio.slice("daily_drop_date:".length).split(",").map((d) => d.trim()).filter(Boolean);
    if (!date.includes(data)) continue;

    let risposte = 0;
    for (const d of date) {
      const g = giornoRomaUtc(d);
      const r = await db
        .prepare(`SELECT 1 FROM post_feed WHERE tipo = 'daily_drop' AND user_id = ? AND data >= ? AND data < ? LIMIT 1`)
        .bind(userId, g.da, g.a)
        .first();
      if (r) risposte++;
    }
    if (risposte < date.length) continue;

    const ins = await db
      .prepare(`INSERT OR IGNORE INTO partecipazioni_sfide_extra (sfida_extra_id, user_id) VALUES (?, ?)`)
      .bind(s.id, userId)
      .run();
    if ((ins.meta.changes ?? 0) === 0) continue; // già fatta

    // Dopo la fine del mese della sfida: punti all'ultimo secondo di quel mese (ora di Roma).
    const meseSfida = `${s.anno}-${String(s.mese).padStart(2, "0")}`;
    const meseOra = adessoRoma().toISOString().slice(0, 7);
    let dataPunti: string | null = null;
    if (meseOra > meseSfida) {
      const fine = new Date(`${mezzanotteRomaUtc(s.mese === 12 ? s.anno + 1 : s.anno, s.mese === 12 ? 1 : s.mese + 1).replace(" ", "T")}Z`);
      dataPunti = new Date(fine.getTime() - 1000).toISOString().slice(0, 19).replace("T", " ");
    }
    if (s.punti) {
      await db
        .prepare(
          `INSERT INTO xp_log (user_id, azione, xp_assegnati, motivo, data) VALUES (?, ?, ?, ?, COALESCE(?, datetime('now')))`
        )
        .bind(userId, `sfida_extra_${s.id}`, s.punti, s.titolo, dataPunti)
        .run();
    }
    await db.prepare(`INSERT INTO post_feed (user_id, tipo, testo) VALUES (?, 'sfida', ?)`).bind(userId, s.titolo).run();
  }
}
