import type { Env, Role, SessionUser } from "../types";

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
    .prepare(`INSERT INTO sessioni_login (token, user_id, scade_il, user_agent) VALUES (?, ?, ?, ?)`)
    .bind(token, user.userId, expiresAt.toISOString(), userAgent)
    .run();

  return { token, expiresAt };
}

export async function getSession(db: D1Database, token: string): Promise<SessionUser | null> {
  const row = await db
    .prepare(
      `SELECT u.id AS userId, u.role AS role
       FROM sessioni_login s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.scade_il > datetime('now')`
    )
    .bind(token)
    .first<{ userId: number; role: Role }>();

  if (!row) return null;
  return { userId: row.userId, role: row.role };
}

export async function deleteSession(db: D1Database, token: string): Promise<void> {
  await db.prepare(`DELETE FROM sessioni_login WHERE token = ?`).bind(token).run();
}
