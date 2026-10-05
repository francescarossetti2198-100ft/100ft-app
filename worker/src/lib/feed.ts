// Post generati dal sistema nel feed (brief, sezione 11). Tipi in uso: level_up,
// consistency, daily_drop, sfida (ogni sfida completata), badge, annuncio_coach.
// new_pb / athlete_of_week: dichiarati nello schema ma non ancora collegati.
export async function pubblicaPost(
  db: D1Database,
  userId: number | null,
  tipo: string,
  testo: string
): Promise<void> {
  await db.prepare(`INSERT INTO post_feed (user_id, tipo, testo) VALUES (?, ?, ?)`).bind(userId, tipo, testo).run();
}
