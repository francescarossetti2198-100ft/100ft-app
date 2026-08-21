// XP log — mai totali fissi, sempre calcolati al volo dalla tabella (brief, sezione 3-4).
export async function awardXp(db: D1Database, userId: number, azione: string, xp: number): Promise<void> {
  await db.prepare(`INSERT INTO xp_log (user_id, azione, xp_assegnati) VALUES (?, ?, ?)`).bind(userId, azione, xp).run();
}
