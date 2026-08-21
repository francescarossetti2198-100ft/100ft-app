import { api, ApiError } from "../api.js";
import { setUser } from "../auth.js";
import { navigate } from "../router.js";

export function renderRegistrazione(appEl) {
  const el = document.createElement("div");
  el.className = "screen";
  el.innerHTML = `
    <h1>Registrati</h1>
    <p class="mono" style="color:var(--mute)">100FT Functional Training — Centocelle</p>
    <form id="registrazione-form" style="margin-top:24px">
      <div class="field">
        <label for="nome">Nome</label>
        <input id="nome" type="text" autocomplete="given-name" required />
      </div>
      <div class="field">
        <label for="cognome">Cognome</label>
        <input id="cognome" type="text" autocomplete="family-name" required />
      </div>
      <div class="field">
        <label for="nickname">Nickname (opzionale)</label>
        <input id="nickname" type="text" autocomplete="nickname" />
      </div>
      <div class="field">
        <label for="data_nascita">Data di nascita (opzionale)</label>
        <input id="data_nascita" type="date" autocomplete="bday" />
      </div>
      <div class="field">
        <label for="email">Email</label>
        <input id="email" type="email" autocomplete="email" required />
      </div>
      <div class="field">
        <label for="password">Password</label>
        <input id="password" type="password" autocomplete="new-password" minlength="8" required />
      </div>
      <div class="field">
        <label for="conferma-password">Conferma password</label>
        <input id="conferma-password" type="password" autocomplete="new-password" minlength="8" required />
      </div>
      <p class="error-text" id="registrazione-error" hidden></p>
      <button class="btn" type="submit" style="width:100%">Crea account</button>
    </form>
    <div style="margin-top:16px">
      <button class="link-btn" id="goto-login">Hai già un account? Accedi</button>
    </div>
  `;
  appEl.appendChild(el);

  const form = el.querySelector("#registrazione-form");
  const errorEl = el.querySelector("#registrazione-error");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.hidden = true;

    const nome = el.querySelector("#nome").value;
    const cognome = el.querySelector("#cognome").value;
    const nickname = el.querySelector("#nickname").value;
    const data_nascita = el.querySelector("#data_nascita").value;
    const email = el.querySelector("#email").value;
    const password = el.querySelector("#password").value;
    const confermaPassword = el.querySelector("#conferma-password").value;

    if (password !== confermaPassword) {
      errorEl.textContent = "Le password non coincidono";
      errorEl.hidden = false;
      return;
    }

    try {
      const user = await api.post("/auth/register", {
        nome,
        cognome,
        nickname: nickname || undefined,
        data_nascita: data_nascita || undefined,
        email,
        password,
      });
      setUser({ isCoach: false, atletaId: user.id });
      navigate("/");
    } catch (err) {
      errorEl.textContent = err instanceof ApiError ? err.message : "Errore imprevisto";
      errorEl.hidden = false;
    }
  });

  el.querySelector("#goto-login").addEventListener("click", () => navigate("/login"));
}
