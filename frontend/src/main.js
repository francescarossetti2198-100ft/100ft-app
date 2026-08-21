import "./style.css";
import { registerRoute, startRouter } from "./router.js";
import { loadSession } from "./auth.js";
import { renderLogin } from "./pages/login.js";
import { renderRegistrazione } from "./pages/registrazione.js";
import { renderPasswordDimenticata } from "./pages/password-dimenticata.js";
import { renderResetPassword } from "./pages/reset-password.js";
import { renderHome } from "./pages/home.js";
import { renderProgramma } from "./pages/programma.js";
import { renderSfide } from "./pages/sfide.js";
import { renderFeed } from "./pages/feed.js";
import { renderProfilo } from "./pages/profilo.js";

registerRoute("/login", { render: renderLogin, protected: false });
registerRoute("/registrati", { render: renderRegistrazione, protected: false });
registerRoute("/password-dimenticata", { render: renderPasswordDimenticata, protected: false });
registerRoute("/reset-password", { render: renderResetPassword, protected: false });
registerRoute("/", { render: renderHome });
registerRoute("/programma", { render: renderProgramma });
registerRoute("/sfide", { render: renderSfide });
registerRoute("/feed", { render: renderFeed });
registerRoute("/profilo", { render: renderProfilo });

async function bootstrap() {
  await loadSession();
  startRouter(document.getElementById("app"));
}

bootstrap();
