import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import { requireAuth } from "../middleware/auth";

type Variables = { user: SessionUser };
const push = new Hono<{ Bindings: Env; Variables: Variables }>();

// Chiave pubblica VAPID — il client la usa per iscriversi (PushManager.subscribe).
push.get("/vapid-public-key", requireAuth, async (c) => {
  return c.json({ publicKey: c.env.VAPID_PUBLIC_KEY });
});

push.post("/", requireAuth, async (c) => {
  const body = await c.req.json<{ endpoint?: string; keys?: { p256dh?: string; auth?: string } }>();
  const { endpoint, keys } = body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) return c.json({ error: "Sottoscrizione non valida" }, 400);

  await c.env.DB.prepare(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)
     ON CONFLICT (endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`
  )
    .bind(c.var.user.userId, endpoint, keys.p256dh, keys.auth)
    .run();

  return c.json({ ok: true }, 201);
});

push.delete("/", requireAuth, async (c) => {
  const { endpoint } = await c.req.json<{ endpoint?: string }>();
  if (!endpoint) return c.json({ error: "Endpoint mancante" }, 400);

  await c.env.DB.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?`)
    .bind(endpoint, c.var.user.userId)
    .run();

  return c.json({ ok: true });
});

export default push;
