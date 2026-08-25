import { renderTabbar } from "../components/tabbar.js";
import { logout } from "../auth.js";
import { navigate } from "../router.js";
import { api, ApiError } from "../api.js";

const MILESTONE_LABEL = {
  first_session: "Prima sessione 🎬",
  "10_sessions": "10 sessioni 🔟",
  "25_sessions": "25 sessioni 🏅",
  first_month: "Primo mese 📅",
  hydration_hero: "Hydration Hero 💧",
  team_player: "Team Player 🤝",
};

// TODO: dati pubblici vs privati, stato pagamento (brief, sezione 14) — servono la Coach
// Dashboard e una decisione su come gestire i dati privati dell'atleta.
export function renderProfilo(appEl) {
  const el = document.createElement("div");
  el.className = "screen";
  el.innerHTML = `
    <h1>Profilo</h1>
    <div id="profilo-content"><p class="mono" style="color:var(--mute)">Carico...</p></div>
    <button class="btn" id="logout-btn" style="margin-top:20px">Esci</button>
  `;
  appEl.appendChild(el);
  appEl.appendChild(renderTabbar());

  el.querySelector("#logout-btn").addEventListener("click", async () => {
    await logout();
    navigate("/login");
  });

  loadProfilo(el);
}

// I 6 livelli del brief (sezione 5) — le card grafiche sono definitive, qui si decide solo
// quali mostrare sbloccate (fino al livello attuale incluso) e quali ancora bloccate.
const NUMERO_LIVELLI = 6;

function scalaLivelliHtml(livello) {
  const attualeNumero = livello?.attuale.numero ?? 0;

  return `
    <div style="display:flex; gap:10px; overflow-x:auto; padding-bottom:4px">
      ${Array.from({ length: NUMERO_LIVELLI }, (_, i) => i + 1)
        .map((n) => {
          const sbloccato = n <= attualeNumero;
          return `
            <div style="flex:0 0 auto; text-align:center">
              <img src="/cards/card_final_${n}.png" alt="Livello ${n}"
                   style="width:64px; height:64px; border-radius:10px; object-fit:cover;
                          ${sbloccato ? "" : "filter:grayscale(1); opacity:0.35"}" />
              ${!sbloccato ? `<img src="/lucchetto.png" alt="Bloccato" style="width:16px; height:16px; margin-top:4px" />` : ""}
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function achievementsHtml(milestones) {
  if (!milestones?.length) {
    return `<p class="mono" style="color:var(--mute); font-size:13px">Nessun traguardo ancora.</p>`;
  }
  return `
    <div style="display:flex; flex-wrap:wrap; gap:8px">
      ${milestones
        .map(
          (m) =>
            `<span class="mono" style="font-size:12px; background:var(--surface-2); border-radius:6px; padding:5px 9px">${MILESTONE_LABEL[m.tipo] ?? m.tipo}</span>`
        )
        .join("")}
    </div>
  `;
}

// Profilo coach: identità + "LA MIA STAGIONE" aggregata sul gruppo, non le statistiche da
// atleta (livello/scala/achievements non si applicano — la coach non si allena).
function renderProfiloCoach(content, p) {
  const nomeVisualizzato = [p.nome, p.cognome].filter(Boolean).join(" ") || "Coach";

  content.innerHTML = `
    <div class="card">
      <p style="font-weight:600">${nomeVisualizzato}</p>
      <p class="mono" style="color:var(--accent); font-size:12px; letter-spacing:1px; margin-top:4px">COACH · 100FT</p>
      <textarea id="coach-bio" rows="2" placeholder="Due righe su di te (facoltativo)"
        style="width:100%; margin-top:12px; background:var(--surface-2); border:1px solid var(--border);
               border-radius:8px; padding:10px 12px; color:var(--text); font-family:inherit; font-size:14px; resize:vertical">${p.bio ?? ""}</textarea>
      <p class="error-text" id="bio-error" hidden style="margin-top:6px"></p>
      <p class="success-text" id="bio-success" hidden style="margin-top:6px">Salvata ✓</p>
      <button class="btn" id="bio-salva" style="width:100%; margin-top:10px">Salva</button>
    </div>
    <div class="card" style="margin-top:12px; display:flex; justify-content:space-around; text-align:center">
      <div>
        <p style="font-weight:600; font-size:18px">${p.stagione.atletiTotali}</p>
        <p class="mono" style="color:var(--mute); font-size:12px">Atleti</p>
      </div>
      <div>
        <p style="font-weight:600; font-size:18px">${p.stagione.settimaneProgramma}</p>
        <p class="mono" style="color:var(--mute); font-size:12px">Settimane</p>
      </div>
      <div>
        <p style="font-weight:600; font-size:18px">${p.stagione.sessioniTotali}</p>
        <p class="mono" style="color:var(--mute); font-size:12px">Sessioni</p>
      </div>
    </div>
    <button class="btn" id="vai-dashboard" style="width:100%; margin-top:12px; background:var(--surface-2); color:var(--text)">Vai alla Coach Dashboard</button>
  `;

  content.querySelector("#vai-dashboard").addEventListener("click", () => navigate("/coach"));

  content.querySelector("#bio-salva").addEventListener("click", async (e) => {
    const errorEl = content.querySelector("#bio-error");
    const successEl = content.querySelector("#bio-success");
    errorEl.hidden = true;
    successEl.hidden = true;
    e.target.disabled = true;
    try {
      await api.post("/profilo/bio", { bio: content.querySelector("#coach-bio").value.trim() });
      successEl.hidden = false;
    } catch (err) {
      errorEl.textContent = err instanceof ApiError ? err.message : "Errore imprevisto";
      errorEl.hidden = false;
    } finally {
      e.target.disabled = false;
    }
  });
}

async function loadProfilo(el) {
  const content = el.querySelector("#profilo-content");
  try {
    const p = await api.get("/profilo/me");

    if (p.role === "coach") {
      renderProfiloCoach(content, p);
      return;
    }

    const nomeVisualizzato = p.nickname || p.nome || "Atleta";

    const statsHtml = `
      <div class="card" style="margin-top:12px; display:flex; justify-content:space-around; text-align:center">
        <div>
          <p style="font-weight:600; font-size:18px">${p.presenzeTotali}</p>
          <p class="mono" style="color:var(--mute); font-size:12px">Presenze tot.</p>
        </div>
        <div>
          <p style="font-weight:600; font-size:18px">${p.anelli.settimaneCompletateTotali}</p>
          <p class="mono" style="color:var(--mute); font-size:12px">Settimane complete</p>
        </div>
        <div>
          <p style="font-weight:600; font-size:18px">${p.puntiTotali}</p>
          <p class="mono" style="color:var(--mute); font-size:12px">Punti totali</p>
        </div>
      </div>
    `;

    const achievementsCard = `
      <div class="card" style="margin-top:12px">
        <p class="mono" style="color:var(--mute); font-size:12px">Achievements</p>
        <div style="margin-top:8px">${achievementsHtml(p.milestones)}</div>
      </div>
    `;

    if (!p.livello) {
      content.innerHTML = `
        <div class="card">
          <p style="font-weight:600">${nomeVisualizzato} ${p.cognome ?? ""}</p>
          <p class="mono" style="color:var(--mute); margin-top:8px">
            Nessun livello ancora — completa la tua prima settimana (Training + Challenges + Feedback) per sbloccarlo.
          </p>
        </div>
        ${statsHtml}
        ${achievementsCard}
      `;
    } else {
      const { attuale } = p.livello;
      content.innerHTML = `
        <div class="card">
          <p style="font-weight:600">${nomeVisualizzato} ${p.cognome ?? ""}</p>
          <p class="mono" style="color:${attuale.colore}; font-size:13px; margin-top:4px">Livello ${attuale.numero} — ${attuale.nome}</p>
        </div>
        <div class="card" style="margin-top:12px; text-align:center">
          <img src="/cards/card_final_${attuale.numero}.png" alt="Livello ${attuale.numero}"
               style="width:120px; height:120px; border-radius:12px; object-fit:cover" />
          <p class="mono" style="color:var(--mute); font-size:12px; margin-top:10px">Scala livelli</p>
          <div style="margin-top:8px">${scalaLivelliHtml(p.livello)}</div>
        </div>
        ${statsHtml}
        ${achievementsCard}
      `;
    }
  } catch (err) {
    content.innerHTML = `<p class="error-text">${err instanceof ApiError ? err.message : "Errore imprevisto"}</p>`;
  }
}
