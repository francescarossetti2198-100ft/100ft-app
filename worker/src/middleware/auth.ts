import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import type { Env, SessionUser } from "../types";
import { SESSION_COOKIE_NAME, getSession } from "../lib/session";

type Variables = { user: SessionUser };

// Popola c.var.user se c'è una sessione valida, altrimenti lascia passare senza bloccare
// (utile per rotte che si comportano diversamente per ospiti/loggati).
export async function attachUser(c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) {
  const token = getCookie(c, SESSION_COOKIE_NAME);
  if (token) {
    const user = await getSession(c.env.DB, token);
    if (user) c.set("user", user);
  }
  await next();
}

// Richiede una sessione valida (atleta o coach).
export async function requireAuth(c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) {
  if (!c.var.user) return c.json({ error: "Non autenticato" }, 401);
  await next();
}

// Richiede specificamente il coach (pannello admin, dati privati, gestione sfide/programma).
export async function requireCoach(c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) {
  if (!c.var.user || c.var.user.role !== "coach") return c.json({ error: "Accesso riservato al coach" }, 403);
  await next();
}
