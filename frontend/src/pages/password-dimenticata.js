import { api, ApiError } from "../api.js";
import { navigate } from "../router.js";

export function renderPasswordDimenticata(appEl) {
  const el = document.createElement("div");
  el.className = "screen";
  el.innerHTML = `
    <h1>Password dimenticata</h1>
    <p class="mono" style="color:var(--mute)">Ti mandiamo un link per reimpostarla via email.</p>
    <form id="forgot-form" style="margin-top:24px">
      <div class="field">
        <label for="email">Email</label>
        <input id="email" type="email" autocomplete="email" required />
      </div>
      <p class="error-text" id="forgot-error" hidden></p>
      <p class="success-text" id="forgot-success" hidden>
        Se l'email è registrata, riceverai a breve un link per reimpostare la password.
      </p>
      <button class="btn" id="forgot-submit" type="submit" style="width:100%">Invia link</button>
    </form>
    <div style="margin-top:16px">
      <button class="link-btn" id="goto-login">Torna al login</button>
    </div>
  `;
  appEl.appendChild(el);

  const form = el.querySelector("#forgot-form");
  const errorEl = el.querySelector("#forgot-error");
  const successEl = el.querySelector("#forgot-success");
  const submitBtn = el.querySelector("#forgot-submit");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    successEl.hidden = true;
    const email = el.querySelector("#email").value;

    try {
      await api.post("/auth/forgot-password", { email });
      successEl.hidden = false;
      submitBtn.disabled = true;
    } catch (err) {
      errorEl.textContent = err instanceof ApiError ? err.message : "Errore imprevisto";
      errorEl.hidden = false;
    }
  });

  el.querySelector("#goto-login").addEventListener("click", () => navigate("/login"));
}
