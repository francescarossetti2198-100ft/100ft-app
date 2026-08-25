import "./style.css";
import { registerRoute, startRouter } from "./router.js";
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
import { renderCoach } from "./pages/coach.js";

registerRoute("/login", { render: renderLogin, protected: false });
registerRoute("/registrati", { render: renderRegistrazione, protected: false });
registerRoute("/password-dimenticata", { render: renderPasswordDimenticata, protected: false });
registerRoute("/reset-password", { render: renderResetPassword, protected: false });
// La coach non ha una sua Home da atleta (niente anelli/presente-assente):
// alla radice vede direttamente la sua dashboard.
registerRoute("/", { render: (appEl) => (getUser()?.role === "coach" ? renderCoach(appEl) : renderHome(appEl)) });
registerRoute("/programma", { render: renderProgramma });
registerRoute("/sfide", { render: renderSfide });
registerRoute("/feed", { render: renderFeed });
registerRoute("/profilo", { render: renderProfilo });
registerRoute("/coach", { render: renderCoach });

async function bootstrap() {
  try {
    await loadSession();
  } catch {
    // Sessione non verificabile per un errore imprevisto (es. rete instabile, worker che si
    // sta riavviando in dev) — meglio far vedere il login e permettere di riprovare, che
    // bloccare l'app per sempre senza più rispondere alla navigazione.
  }
  startRouter(document.getElementById("app"));
}

bootstrap();
