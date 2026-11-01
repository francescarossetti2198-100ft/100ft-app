// XP log — mai totali fissi, sempre calcolati al volo dalla tabella (brief, sezione 3-4).
// `sfidaId` opzionale: valorizzato per l'azione "sfida", così l'eliminazione di una sfida
// dalla dashboard coach può togliere i punti collegati in modo esatto (vedi DELETE /sfide/:id).
// `motivo` opzionale: il "perché" dei punti extra, che l'atleta legge nelle notifiche.
export async function awardXp(
  db: D1Database,
  userId: number,
  azione: string,
  xp: number,
  sfidaId?: number,
  motivo?: string
): Promise<void> {
  await db
    .prepare(`INSERT INTO xp_log (user_id, azione, xp_assegnati, sfida_id, motivo) VALUES (?, ?, ?, ?, ?)`)
    .bind(userId, azione, xp, sfidaId ?? null, motivo ?? null)
    .run();
}
