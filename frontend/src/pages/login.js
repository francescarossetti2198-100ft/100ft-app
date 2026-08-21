import { api, ApiError } from "../api.js";
import { setUser } from "../auth.js";
import { navigate } from "../router.js";

export function renderLogin(appEl) {
  const el = document.createElement("div");
  el.className = "screen";
  el.innerHTML = `
    <h1>100FT</h1>
    <p class="mono" style="color:var(--mute)">Functional Training — Centocelle</p>
    <form id="login-form" style="margin-top:24px">
      <div class="field">
        <label for="email">Email</label>
        <input id="email" type="email" autocomplete="email" required />
      </div>
      <div class="field">
        <label for="password">Password</label>
        <input id="password" type="password" autocomplete="current-password" required />
      </div>
      <p class="error-text" id="login-error" hidden></p>
      <button class="btn" type="submit" style="width:100%">Accedi</button>
    </form>
    <div style="margin-top:16px; display:flex; flex-direction:column; gap:8px; align-items:flex-start">
      <button class="link-btn" id="goto-registrati">Non hai un account? Registrati</button>
      <button class="link-btn" id="goto-password-dimenticata">Password dimenticata?</button>
    </div>
  `;
  appEl.appendChild(el);

  const form = el.querySelector("#login-form");
  const errorEl = el.querySelector("#login-error");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    const email = el.querySelector("#email").value;
    const password = el.querySelector("#password").value;

    try {
      const user = await api.post("/auth/login", { email, password });
      setUser({ userId: user.id, role: user.role });
      navigate("/");
    } catch (err) {
      errorEl.textContent = err instanceof ApiError ? err.message : "Errore imprevisto";
      errorEl.hidden = false;
    }
  });

  el.querySelector("#goto-registrati").addEventListener("click", () => navigate("/registrati"));
  el.querySelector("#goto-password-dimenticata").addEventListener("click", () =>
    navigate("/password-dimenticata")
  );
}
