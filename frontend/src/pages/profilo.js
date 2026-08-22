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
  new_pb: "Primo Personal Best 💪",
};

const ESERCIZI = [
  { valore: "push-ups", label: "Push-up", placeholder: "ripetizioni" },
  { valore: "squat", label: "Squat", placeholder: "ripetizioni" },
  { valore: "corda", label: "Salto con la corda", placeholder: "ripetizioni" },
  { valore: "plank", label: "Plank", placeholder: "secondi di tenuta" },
  { valore: "1km", label: "1km", placeholder: "tempo in secondi" },
];

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
        <div class="card" style="margin-top:12px" id="pb-card"></div>
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
        <div class="card" style="margin-top:12px" id="pb-card"></div>
      `;
    }

    if (p.role === "atleta") loadPersonalBest(el);
  } catch (err) {
    content.innerHTML = `<p class="error-text">${err instanceof ApiError ? err.message : "Errore imprevisto"}</p>`;
  }
}

async function loadPersonalBest(el) {
  const card = el.querySelector("#pb-card");
  if (!card) return;

  try {
    const { personalBest } = await api.get("/personal-best/me");
    const migliori = new Map();
    for (const pb of personalBest) {
      const attuale = migliori.get(pb.esercizio);
      if (!attuale || (pb.isNewPb && !attuale.isNewPb) || pb.data > attuale.data) migliori.set(pb.esercizio, pb);
    }

    const listaHtml = migliori.size
      ? `<div style="display:flex; flex-direction:column; gap:6px; margin-top:8px">
          ${[...migliori.values()]
            .map((pb) => `<div style="display:flex; justify-content:space-between"><span>${pb.esercizio}</span><strong>${pb.valore}</strong></div>`)
            .join("")}
        </div>`
      : `<p class="mono" style="color:var(--mute); font-size:13px; margin-top:8px">Nessun PB registrato ancora.</p>`;

    card.innerHTML = `
      <p class="mono" style="color:var(--mute); font-size:12px">Personal Best</p>
      ${listaHtml}
      <div style="display:flex; gap:6px; margin-top:12px">
        <select id="pb-esercizio" style="flex:1; background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:8px; color:var(--text)">
          ${ESERCIZI.map((e) => `<option value="${e.valore}">${e.label}</option>`).join("")}
        </select>
        <input id="pb-valore" type="text" placeholder="${ESERCIZI[0].placeholder}"
               style="flex:1; background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:8px; color:var(--text)" />
      </div>
      <p class="error-text" id="pb-error" hidden style="margin-top:6px"></p>
      <p class="success-text" id="pb-success" hidden style="margin-top:6px"></p>
      <button class="btn" id="pb-submit" style="width:100%; margin-top:10px">Registra</button>
    `;

    const select = card.querySelector("#pb-esercizio");
    const input = card.querySelector("#pb-valore");
    select.addEventListener("change", () => {
      input.placeholder = ESERCIZI.find((e) => e.valore === select.value)?.placeholder ?? "";
    });

    card.querySelector("#pb-submit").addEventListener("click", async (e) => {
      const errorEl = card.querySelector("#pb-error");
      const successEl = card.querySelector("#pb-success");
      errorEl.hidden = true;
      successEl.hidden = true;
      e.target.disabled = true;
      try {
        const res = await api.post("/personal-best", { esercizio: select.value, valore: input.value });
        successEl.textContent = res.isNewPb ? "Nuovo PB registrato! +20 punti 🎉" : "Registrato (non è un nuovo record).";
        successEl.hidden = false;
        // Un nuovo PB aggiorna anche punti totali e achievements, non solo questa card.
        loadProfilo(el);
      } catch (err) {
        errorEl.textContent = err instanceof ApiError ? err.message : "Errore imprevisto";
        errorEl.hidden = false;
        e.target.disabled = false;
      }
    });
  } catch {
    card.remove();
  }
}
