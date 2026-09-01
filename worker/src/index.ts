import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
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
import performance from "./routes/performance";
import abbonamento from "./routes/abbonamento";
import suddivisioni from "./routes/suddivisioni";
import chiusure from "./routes/chiusure";
import diario from "./routes/diario";
import puntiExtra from "./routes/punti-extra";
import { inviaDailyDropSeAttivo } from "./lib/dailyDropPush";
import { inviaPromemoriaAllenamentoSeAttivo } from "./lib/promemoriaPush";
import { inviaFeedbackMensileSeAttivo } from "./lib/feedbackMensilePush";
import { inviaAppelloSeAttivo } from "./lib/appelloPush";
import { inviaPromemoriaAbbonamentoSeAttivo } from "./lib/abbonamentoPush";
import { inviaPromemoriaAcquaSeAttivo } from "./lib/promemoriaAcquaPush";
import { inviaPromemoriaMerendaSeAttivo } from "./lib/promemoriaMerendaPush";

type Variables = { user: SessionUser };
const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use("*", async (c, next) => {
  const allowed = c.env.FRONTEND_ORIGIN;
  const corsMiddleware = cors({
    // Accetta anche la variante con il punto finale nell'hostname
    // ("https://app.100-ft.com." — FQDN valido ma origin diversa): senza questo
    // il browser da quell'host blocca ogni richiesta e l'app mostra "Errore imprevisto".
    // Il frontend fa comunque un redirect per normalizzare l'host (vedi index.html).
    origin: (origin) => {
      if (!origin) return allowed;
      return origin.replace(/\.$/, "") === allowed ? origin : allowed;
    },
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
app.route("/api/performance", performance);
app.route("/api/abbonamento", abbonamento);
app.route("/api/suddivisioni", suddivisioni);
app.route("/api/chiusure", chiusure);
app.route("/api/diario", diario);
app.route("/api/punti-extra", puntiExtra);

// Esempio di rotta protetta — punto di partenza per pagamenti/coach dashboard,
// da costruire seguendo lo stesso pattern (vedi worker/src/routes/auth.ts).
app.get("/api/ping", requireAuth, (c) => c.json({ user: c.var.user }));

// Qualsiasi errore non gestito in una rotta torna JSON `{ error }` (status 500), non un
// 500 testuale — così l'app mostra un messaggio pulito invece di "Errore imprevisto".
app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse();
  console.error("Errore non gestito:", err instanceof Error ? (err.stack ?? err.message) : err);
  return c.json({ error: "Si è verificato un errore imprevisto. Riprova tra poco." }, 500);
});

export default {
  fetch: app.fetch,
  // Cron Trigger (wrangler.toml [triggers]) — controlla ogni minuto se è ora del Daily Drop
  // di oggi e manda il push a chi è iscritto (vedi lib/dailyDropPush.ts).
  scheduled: async (_event: ScheduledEvent, env: Env, ctx: ExecutionContext) => {
    ctx.waitUntil(inviaDailyDropSeAttivo(env));
    ctx.waitUntil(inviaPromemoriaAllenamentoSeAttivo(env));
    ctx.waitUntil(inviaFeedbackMensileSeAttivo(env));
    ctx.waitUntil(inviaAppelloSeAttivo(env));
    ctx.waitUntil(inviaPromemoriaAbbonamentoSeAttivo(env));
    ctx.waitUntil(inviaPromemoriaAcquaSeAttivo(env));
    ctx.waitUntil(inviaPromemoriaMerendaSeAttivo(env));
  },
};
