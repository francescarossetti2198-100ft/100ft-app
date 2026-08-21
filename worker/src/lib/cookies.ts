import type { Context } from "hono";
import type { CookieOptions } from "hono/utils/cookie";

// In sviluppo il frontend Vite fa da proxy verso il worker (vedi frontend/vite.config.js),
// quindi dal punto di vista del browser è same-origin: cookie semplice va bene.
// In produzione Pages e Workers sono su domini diversi (cross-site): serve
// SameSite=None + Secure, disponibile perché Cloudflare serve tutto in HTTPS.
export function sessionCookieOptions(c: Context, expires?: Date): CookieOptions {
  const hostname = new URL(c.req.url).hostname;
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1";

  return {
    httpOnly: true,
    path: "/",
    secure: !isLocal,
    sameSite: isLocal ? "Lax" : "None",
    expires,
  };
}
