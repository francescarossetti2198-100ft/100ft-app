// Milestones raccolte in "Achievements" nel Profile (brief, sezione 10).
// hydration_hero/team_player non ancora assegnabili: richiedono Daily Drop e feature social
// non ancora costruite.
export async function assegnaMilestone(db: D1Database, userId: number, tipo: string): Promise<boolean> {
  const result = await db
    .prepare(`INSERT INTO milestones (user_id, tipo) VALUES (?, ?) ON CONFLICT (user_id, tipo) DO NOTHING`)
    .bind(userId, tipo)
    .run();
  return (result.meta.changes ?? 0) > 0;
}
