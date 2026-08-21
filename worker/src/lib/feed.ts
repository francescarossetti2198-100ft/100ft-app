// Post generati dal sistema nel feed (brief, sezione 11) — solo i tipi previsti dallo
// schema (level_up, consistency, annuncio_coach per ora; new_pb/athlete_of_week/daily_drop
// richiedono feature non ancora costruite).
export async function pubblicaPost(
  db: D1Database,
  userId: number | null,
  tipo: string,
  testo: string
): Promise<void> {
  await db.prepare(`INSERT INTO post_feed (user_id, tipo, testo) VALUES (?, ?, ?)`).bind(userId, tipo, testo).run();
}
