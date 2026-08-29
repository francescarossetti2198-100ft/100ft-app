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
import dailyDrop from "./routes/daily-drop";
import foto from "./routes/foto";
import feedback from "./routes/feedback";
import atleti from "./routes/atleti";
import pagamenti from "./routes/pagamenti";
import push from "./routes/push";
import feedbackMensile from "./routes/feedback-mensile";
import { inviaDailyDropSeAttivo } from "./lib/dailyDropPush";
import { inviaPromemoriaAllenamentoSeAttivo } from "./lib/promemoriaPush";
import { inviaFeedbackMensileSeAttivo } from "./lib/feedbackMensilePush";

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
app.route("/api/daily-drop", dailyDrop);
app.route("/api/foto", foto);
app.route("/api/feedback", feedback);
app.route("/api/atleti", atleti);
app.route("/api/pagamenti", pagamenti);
app.route("/api/push", push);
app.route("/api/feedback-mensile", feedbackMensile);

// Esempio di rotta protetta — punto di partenza per pagamenti/coach dashboard,
// da costruire seguendo lo stesso pattern (vedi worker/src/routes/auth.ts).
app.get("/api/ping", requireAuth, (c) => c.json({ user: c.var.user }));

export default {
  fetch: app.fetch,
  // Cron Trigger (wrangler.toml [triggers]) — controlla ogni minuto se è ora del Daily Drop
  // di oggi e manda il push a chi è iscritto (vedi lib/dailyDropPush.ts).
  scheduled: async (_event: ScheduledEvent, env: Env, ctx: ExecutionContext) => {
    ctx.waitUntil(inviaDailyDropSeAttivo(env));
    ctx.waitUntil(inviaPromemoriaAllenamentoSeAttivo(env));
    ctx.waitUntil(inviaFeedbackMensileSeAttivo(env));
  },
};
