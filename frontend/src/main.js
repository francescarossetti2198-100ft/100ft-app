import "./style.css";
import { registerRoute, startRouter, navigate } from "./router.js";
import { mountThemeToggle } from "./theme.js";
import { loadSession, getUser } from "./auth.js";
import { renderLogin } from "./pages/login.js";
import { renderRegistrazione } from "./pages/registrazione.js";
import { renderPasswordDimenticata } from "./pages/password-dimenticata.js";
import { renderResetPassword } from "./pages/reset-password.js";
import { renderHome } from "./pages/home.js";
import { renderProgramma } from "./pages/programma.js";
import { renderSfide } from "./pages/sfide.js";
import { renderFeed } from "./pages/feed.js";
import { renderProfilo } from "./pages/profilo.js";
import { renderAtletaPubblico } from "./pages/atleta.js";
import { renderCoachOggi } from "./pages/coach/oggi.js";
import { renderCoachDiario } from "./pages/coach/diario.js";
import { renderCoachPresenze } from "./pages/coach/presenze.js";
import { renderCoachChiusure } from "./pages/coach/chiusure.js";
import { renderCoachMese } from "./pages/coach/mese.js";
import { renderCoachSfide } from "./pages/coach/sfide.js";
import { renderCoachAtleti } from "./pages/coach/atleti.js";
import { renderCoachPuntiExtra } from "./pages/coach/punti-extra.js";
import { renderCoachComunicazioni } from "./pages/coach/comunicazioni.js";
import { renderCoachFeed } from "./pages/coach/feed.js";
import { renderCoachAbbonamenti } from "./pages/coach/abbonamenti.js";
import { renderCoachImpostazioni } from "./pages/coach/impostazioni.js";

registerRoute("/login", { render: renderLogin, protected: false });
registerRoute("/registrati", { render: renderRegistrazione, protected: false });
registerRoute("/password-dimenticata", { render: renderPasswordDimenticata, protected: false });
registerRoute("/reset-password", { render: renderResetPassword, protected: false });

// La coach non ha una Home/tabbar da atleta: alla radice va alla sua dashboard (menù ☰).
const perCoach = (rottaCoach) => (renderAtleta) => (appEl) =>
  getUser()?.role === "coach" ? navigate(rottaCoach) : renderAtleta(appEl);

registerRoute("/", { render: (appEl) => (getUser()?.role === "coach" ? navigate("/coach") : renderHome(appEl)) });
registerRoute("/programma", { render: perCoach("/coach")(renderProgramma) });
registerRoute("/sfide", { render: perCoach("/coach/sfide")(renderSfide) });
registerRoute("/feed", { render: perCoach("/coach/feed")(renderFeed) });
registerRoute("/profilo", { render: renderProfilo });
registerRoute("/atleta", { render: renderAtletaPubblico });

registerRoute("/coach", { render: renderCoachOggi });
registerRoute("/coach/diario", { render: renderCoachDiario });
registerRoute("/coach/presenze", { render: renderCoachPresenze });
registerRoute("/coach/chiusure", { render: renderCoachChiusure });
registerRoute("/coach/mese", { render: renderCoachMese });
registerRoute("/coach/sfide", { render: renderCoachSfide });
registerRoute("/coach/atleti", { render: renderCoachAtleti });
registerRoute("/coach/punti-extra", { render: renderCoachPuntiExtra });
registerRoute("/coach/comunicazioni", { render: renderCoachComunicazioni });
registerRoute("/coach/feed", { render: renderCoachFeed });
registerRoute("/coach/abbonamenti", { render: renderCoachAbbonamenti });
registerRoute("/coach/impostazioni", { render: renderCoachImpostazioni });

// Registrazione service worker (injectRegister:false in vite.config.js). `updateViaCache:
// "none"` = per controllare se c'è un SW nuovo, il browser scarica sempre /sw.js dalla
// rete, ignorando la cache HTTP: sul dominio custom Cloudflare serve /sw.js con
// max-age=14400 (4h), quindi senza questo un deploy non verrebbe visto per ore.
if ("serviceWorker" in navigator) {
  const eraGiaControllato = Boolean(navigator.serviceWorker.controller);

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  });

  // Quando il SW nuovo prende il controllo (skipWaiting + clients.claim in src/sw.js),
  // ricarica una volta sola per mostrare subito la versione aggiornata. Il controllo su
  // `eraGiaControllato` esclude la primissima visita, dove il claim non è un aggiornamento.
  if (eraGiaControllato) {
    let inRicarica = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (inRicarica) return;
      inRicarica = true;
      window.location.reload();
    });
  }
}

async function bootstrap() {
  try {
    await loadSession();
  } catch {
    // Sessione non verificabile per un errore imprevisto (es. rete instabile, worker che si
    // sta riavviando in dev) — meglio far vedere il login e permettere di riprovare, che
    // bloccare l'app per sempre senza più rispondere alla navigazione.
  }
  mountThemeToggle();
  startRouter(document.getElementById("app"));
}

bootstrap();
