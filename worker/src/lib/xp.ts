// XP log — mai totali fissi, sempre calcolati al volo dalla tabella (brief, sezione 3-4).
// `sfidaId` opzionale: valorizzato per l'azione "sfida", così l'eliminazione di una sfida
// dalla dashboard coach può togliere i punti collegati in modo esatto (vedi DELETE /sfide/:id).
export async function awardXp(
  db: D1Database,
  userId: number,
  azione: string,
  xp: number,
  sfidaId?: number
): Promise<void> {
  await db
    .prepare(`INSERT INTO xp_log (user_id, azione, xp_assegnati, sfida_id) VALUES (?, ?, ?, ?)`)
    .bind(userId, azione, xp, sfidaId ?? null)
    .run();
}
