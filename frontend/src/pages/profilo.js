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

function scalaLivelliHtml(livello) {
  // I 6 livelli del brief (sezione 5), hardcoded qui solo per etichette/soglie —
  // la fonte di verità resta worker/src/lib/livelli.ts.
  const LIVELLI = [
    { numero: 1, settimaneMin: 1 },
    { numero: 2, settimaneMin: 4 },
    { numero: 3, settimaneMin: 9 },
    { numero: 4, settimaneMin: 16 },
    { numero: 5, settimaneMin: 25 },
    { numero: 6, settimaneMin: 35 },
  ];
  const attualeNumero = livello?.attuale.numero ?? 0;

  return `
    <div style="display:flex; gap:8px; overflow-x:auto; padding-bottom:4px">
      ${LIVELLI.map((l) => {
        const stato = l.numero < attualeNumero ? "✓" : l.numero === attualeNumero ? "●" : "";
        const prossimoMin = LIVELLI[l.numero]?.settimaneMin;
        const range = prossimoMin ? `${l.settimaneMin}–${prossimoMin - 1}` : `${l.settimaneMin}+`;
        return `
          <div style="flex:0 0 auto; min-width:64px; text-align:center; padding:8px; border-radius:8px;
                      border:1px solid ${l.numero === attualeNumero ? "var(--accent)" : "var(--border)"}">
            <p class="mono" style="font-size:11px; color:var(--mute)">${range} sett.</p>
            <p style="margin-top:4px">${stato || "&nbsp;"}</p>
          </div>
        `;
      }).join("")}
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

async function loadProfilo(el) {
  const content = el.querySelector("#profilo-content");
  try {
    const p = await api.get("/profilo/me");
    const nomeVisualizzato = p.nickname || p.nome || (p.role === "coach" ? "Coach" : "Atleta");

    const statsHtml = `
      <div class="card" style="margin-top:12px; display:flex; justify-content:space-around; text-align:center">
        <div>
          <p style="font-weight:600; font-size:18px">${p.presenzeTotali}</p>
          <p class="mono" style="color:var(--mute); font-size:12px">Presenze tot.</p>
        </div>
        <div>
          <p style="font-weight:600; font-size:18px">${p.anelli.streakSettimane}</p>
          <p class="mono" style="color:var(--mute); font-size:12px">Streak sett.</p>
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
            Nessun livello ancora — chiudi l'anello allenamenti per la prima settimana per sbloccarlo.
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
