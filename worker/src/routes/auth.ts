import { Hono } from "hono";
import { setCookie, deleteCookie, getCookie } from "hono/cookie";
import type { Env, SessionUser } from "../types";
import { hashPassword, verifyPassword } from "../lib/password";
import { createSession, deleteSession, SESSION_COOKIE_NAME } from "../lib/session";
import { sessionCookieOptions } from "../lib/cookies";
import { sendResetPasswordEmail } from "../lib/email";

type Variables = { user: SessionUser };
const auth = new Hono<{ Bindings: Env; Variables: Variables }>();

// Registrazione atleta — email + password scelta in fase di registrazione (brief, sezione 2).
auth.post("/register", async (c) => {
  const body = await c.req.json<{
    nome?: string;
    cognome?: string;
    nickname?: string;
    email?: string;
    password?: string;
    data_nascita?: string;
  }>();

  const { nome, cognome, email, password } = body;
  if (!nome || !cognome || !email || !password) {
    return c.json({ error: "Nome, cognome, email e password sono obbligatori" }, 400);
  }
  if (password.length < 8) {
    return c.json({ error: "La password deve avere almeno 8 caratteri" }, 400);
  }

  const existing = await c.env.DB.prepare(`SELECT id FROM atleti WHERE email = ?`).bind(email).first();
  if (existing) return c.json({ error: "Email già registrata" }, 409);

  const passwordHash = await hashPassword(password);
  const result = await c.env.DB.prepare(
    `INSERT INTO atleti (nome, cognome, nickname, email, password_hash, data_nascita)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(nome, cognome, body.nickname ?? null, email, passwordHash, body.data_nascita ?? null)
    .run();

  const atletaId = result.meta.last_row_id as number;
  const user: SessionUser = { isCoach: false, atletaId };
  const { token, expiresAt } = await createSession(c.env.DB, user, c.req.header("User-Agent") ?? null);
  setCookie(c, SESSION_COOKIE_NAME, token, sessionCookieOptions(c, expiresAt));

  return c.json({ id: atletaId, nome, cognome, email }, 201);
});

// Login atleta.
auth.post("/login", async (c) => {
  const { email, password } = await c.req.json<{ email?: string; password?: string }>();
  if (!email || !password) return c.json({ error: "Email e password sono obbligatori" }, 400);

  const atleta = await c.env.DB.prepare(
    `SELECT id, password_hash, attivo FROM atleti WHERE email = ?`
  )
    .bind(email)
    .first<{ id: number; password_hash: string; attivo: number }>();

  if (!atleta || !atleta.attivo || !(await verifyPassword(password, atleta.password_hash))) {
    return c.json({ error: "Email o password non corretti" }, 401);
  }

  const user: SessionUser = { isCoach: false, atletaId: atleta.id };
  const { token, expiresAt } = await createSession(c.env.DB, user, c.req.header("User-Agent") ?? null);
  setCookie(c, SESSION_COOKIE_NAME, token, sessionCookieOptions(c, expiresAt));

  return c.json({ id: atleta.id });
});

// Login coach — password separata (secret COACH_PASSWORD_HASH), nessun account nella tabella atleti.
auth.post("/login-coach", async (c) => {
  const { password } = await c.req.json<{ password?: string }>();
  if (!password) return c.json({ error: "Password obbligatoria" }, 400);

  if (!c.env.COACH_PASSWORD_HASH || !(await verifyPassword(password, c.env.COACH_PASSWORD_HASH))) {
    return c.json({ error: "Password non corretta" }, 401);
  }

  const user: SessionUser = { isCoach: true, atletaId: null };
  const { token, expiresAt } = await createSession(c.env.DB, user, c.req.header("User-Agent") ?? null);
  setCookie(c, SESSION_COOKIE_NAME, token, sessionCookieOptions(c, expiresAt));

  return c.json({ isCoach: true });
});

auth.post("/logout", async (c) => {
  const token = getCookie(c, SESSION_COOKIE_NAME);
  if (token) await deleteSession(c.env.DB, token);
  deleteCookie(c, SESSION_COOKIE_NAME, { path: "/" });
  return c.json({ ok: true });
});

auth.get("/me", async (c) => {
  if (!c.var.user) return c.json({ error: "Non autenticato" }, 401);
  return c.json(c.var.user);
});

// Recupero password (atleti) via email Resend.
auth.post("/forgot-password", async (c) => {
  const { email } = await c.req.json<{ email?: string }>();
  if (!email) return c.json({ error: "Email obbligatoria" }, 400);

  const atleta = await c.env.DB.prepare(`SELECT id FROM atleti WHERE email = ?`).bind(email).first<{ id: number }>();

  // Risposta identica sia che l'email esista o no, per non rivelare quali email sono registrate.
  if (atleta) {
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await c.env.DB.prepare(
      `INSERT INTO reset_password_token (token, atleta_id, scade_il) VALUES (?, ?, ?)`
    )
      .bind(token, atleta.id, expiresAt)
      .run();

    // Router del frontend è hash-based (SPA su Cloudflare Pages, niente rotte server-side).
    const resetUrl = `${c.env.FRONTEND_ORIGIN}/#/reset-password?token=${token}`;
    await sendResetPasswordEmail(c.env, email, resetUrl);
  }

  return c.json({ ok: true });
});

auth.post("/reset-password", async (c) => {
  const { token, password } = await c.req.json<{ token?: string; password?: string }>();
  if (!token || !password) return c.json({ error: "Token e password sono obbligatori" }, 400);
  if (password.length < 8) return c.json({ error: "La password deve avere almeno 8 caratteri" }, 400);

  const row = await c.env.DB.prepare(
    `SELECT atleta_id AS atletaId FROM reset_password_token
     WHERE token = ? AND usato = 0 AND scade_il > datetime('now')`
  )
    .bind(token)
    .first<{ atletaId: number }>();

  if (!row) return c.json({ error: "Link non valido o scaduto" }, 400);

  const passwordHash = await hashPassword(password);
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE atleti SET password_hash = ? WHERE id = ?`).bind(passwordHash, row.atletaId),
    c.env.DB.prepare(`UPDATE reset_password_token SET usato = 1 WHERE token = ?`).bind(token),
  ]);

  return c.json({ ok: true });
});

export default auth;
