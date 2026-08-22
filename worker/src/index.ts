import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env, SessionUser } from "./types";
import { attachUser, requireAuth } from "./middleware/auth";
import auth from "./routes/auth";
import presenze from "./routes/presenze";
import sfide from "./routes/sfide";
import profilo from "./routes/profilo";
import notaCoach from "./routes/nota-coach";
import richieste from "./routes/richieste";
import programma from "./routes/programma";
import feed from "./routes/feed";
import personalBest from "./routes/personal-best";
import dailyDrop from "./routes/daily-drop";
import foto from "./routes/foto";

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

// Risposte API sempre dinamiche/autenticate: mai in cache lato browser.
app.use("*", async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store");
});

app.get("/api/health", (c) => c.json({ ok: true }));

app.route("/api/auth", auth);
app.route("/api/presenze", presenze);
app.route("/api/sfide", sfide);
app.route("/api/profilo", profilo);
app.route("/api/nota-coach", notaCoach);
app.route("/api/richieste", richieste);
app.route("/api/programma", programma);
app.route("/api/feed", feed);
app.route("/api/personal-best", personalBest);
app.route("/api/daily-drop", dailyDrop);
app.route("/api/foto", foto);

// Esempio di rotta protetta — punto di partenza per pagamenti/coach dashboard,
// da costruire seguendo lo stesso pattern (vedi worker/src/routes/auth.ts).
app.get("/api/ping", requireAuth, (c) => c.json({ user: c.var.user }));

export default app;
