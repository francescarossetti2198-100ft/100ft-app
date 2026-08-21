import type { Env, SessionUser } from "../types";

// Sessioni "lunghe": il device ricorda il login (brief, sezione 2), niente re-login ogni volta.
const SESSION_DURATION_DAYS = 180;

export const SESSION_COOKIE_NAME = "100ft_session";

function generateToken(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

function toHex(buffer: Uint8Array): string {
  return Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createSession(
  db: D1Database,
  user: SessionUser,
  userAgent: string | null
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);

  await db
    .prepare(
      `INSERT INTO sessioni_login (token, atleta_id, is_coach, scade_il, user_agent)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(token, user.isCoach ? null : user.atletaId, user.isCoach ? 1 : 0, expiresAt.toISOString(), userAgent)
    .run();

  return { token, expiresAt };
}

export async function getSession(db: D1Database, token: string): Promise<SessionUser | null> {
  const row = await db
    .prepare(
      `SELECT atleta_id AS atletaId, is_coach AS isCoach
       FROM sessioni_login
       WHERE token = ? AND scade_il > datetime('now')`
    )
    .bind(token)
    .first<{ atletaId: number | null; isCoach: number }>();

  if (!row) return null;
  if (row.isCoach) return { isCoach: true, atletaId: null };
  if (row.atletaId === null) return null;
  return { isCoach: false, atletaId: row.atletaId };
}

export async function deleteSession(db: D1Database, token: string): Promise<void> {
  await db.prepare(`DELETE FROM sessioni_login WHERE token = ?`).bind(token).run();
}
