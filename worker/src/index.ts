import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env, SessionUser } from "./types";
import { attachUser, requireAuth } from "./middleware/auth";
import auth from "./routes/auth";
import presenze from "./routes/presenze";
import sfide from "./routes/sfide";
import profilo from "./routes/profilo";

type Variables = { user: SessionUser };
const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use("*", async (c, next) => {
  const corsMiddleware = cors({
    origin: c.env.FRONTEND_ORIGIN,
    credentials: true,
  });
  return corsMiddleware(c, next);
});

app.use("*", attachUser);

app.get("/api/health", (c) => c.json({ ok: true }));

app.route("/api/auth", auth);
app.route("/api/presenze", presenze);
app.route("/api/sfide", sfide);
app.route("/api/profilo", profilo);

// Esempio di rotta protetta — punto di partenza per atleti/programma/sfide/feed/pagamenti,
// da costruire seguendo lo stesso pattern (vedi worker/src/routes/auth.ts).
app.get("/api/ping", requireAuth, (c) => c.json({ user: c.var.user }));

export default app;
