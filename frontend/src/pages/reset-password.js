import { api, ApiError } from "../api.js";
import { navigate, currentQuery } from "../router.js";

export function renderResetPassword(appEl) {
  const token = currentQuery().get("token");

  const el = document.createElement("div");
  el.className = "screen";

  if (!token) {
    el.innerHTML = `
      <h1>Link non valido</h1>
      <p class="error-text">Il link per reimpostare la password non è valido o è incompleto.</p>
      <button class="link-btn" id="goto-login">Torna al login</button>
    `;
    appEl.appendChild(el);
    el.querySelector("#goto-login").addEventListener("click", () => navigate("/login"));
    return;
  }

  el.innerHTML = `
    <h1>Reimposta password</h1>
    <form id="reset-form" style="margin-top:24px">
      <div class="field">
        <label for="password">Nuova password</label>
        <input id="password" type="password" autocomplete="new-password" minlength="8" required />
      </div>
      <div class="field">
        <label for="conferma-password">Conferma password</label>
        <input id="conferma-password" type="password" autocomplete="new-password" minlength="8" required />
      </div>
      <p class="error-text" id="reset-error" hidden></p>
      <p class="success-text" id="reset-success" hidden>Password aggiornata. Ora puoi accedere.</p>
      <button class="btn" id="reset-submit" type="submit" style="width:100%">Reimposta password</button>
    </form>
  `;
  appEl.appendChild(el);

  const form = el.querySelector("#reset-form");
  const errorEl = el.querySelector("#reset-error");
  const successEl = el.querySelector("#reset-success");
  const submitBtn = el.querySelector("#reset-submit");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    successEl.hidden = true;

    const password = el.querySelector("#password").value;
    const confermaPassword = el.querySelector("#conferma-password").value;

    if (password !== confermaPassword) {
      errorEl.textContent = "Le password non coincidono";
      errorEl.hidden = false;
      return;
    }

    try {
      await api.post("/auth/reset-password", { token, password });
      successEl.hidden = false;
      submitBtn.disabled = true;
      setTimeout(() => navigate("/login"), 1500);
    } catch (err) {
      errorEl.textContent = err instanceof ApiError ? err.message : "Errore imprevisto";
      errorEl.hidden = false;
    }
  });
}
