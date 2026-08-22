import { renderTabbar } from "../components/tabbar.js";
import { api, ApiError } from "../api.js";

const CATEGORIE = ["Legs", "Mobility", "Upper Body", "Alta intensità", "Other"];

// Scala fissa del feedback "How was today?" — sempre queste 5 faccine, in quest'ordine,
// mai sostituite con stelle, slider, numeri o altre emoji.
const FACCE = [
  { valore: 1, emoji: "😫", titolo: "Pessima giornata" },
  { valore: 2, emoji: "😕", titolo: "Non benissimo" },
  { valore: 3, emoji: "😐", titolo: "Nella media" },
  { valore: 4, emoji: "🙂", titolo: "Andata bene" },
  { valore: 5, emoji: "🔥", titolo: "Fantastico" },
];

const GIORNI = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];

function formattaData(dataIso) {
  const d = new Date(`${dataIso}T00:00:00Z`);
  const giorno = GIORNI[(d.getUTCDay() + 6) % 7];
  return `${giorno} ${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function renderHome(appEl) {
  const el = document.createElement("div");
  el.className = "screen";
  el.innerHTML = `
    <p class="mono" style="color:var(--mute); font-size:13px">Bentornato</p>
    <h1 id="saluto-nome">Home</h1>
    <div class="card" id="progresso-card" style="margin-top:12px">
      <p class="mono" style="color:var(--mute)">Carico...</p>
    </div>
    <div class="card" id="nota-coach-card" style="margin-top:12px"></div>
    <div class="card" id="presenza-card" style="margin-top:12px">
      <p class="mono" style="color:var(--mute)">Carico...</p>
    </div>
    <div id="feedback-cards" style="margin-top:12px"></div>
    <div class="card" id="richieste-card" style="margin-top:12px"></div>
  `;
  appEl.appendChild(el);
  appEl.appendChild(renderTabbar());

  loadPresenza(el);
  loadProgresso(el);
  loadNotaCoach(el);
  loadFeedbackDaDare(el);
  loadRichieste(el);
}

async function loadNotaCoach(el) {
  const card = el.querySelector("#nota-coach-card");
  try {
    const { testo } = await api.get("/nota-coach");
    if (!testo) {
      card.remove();
      return;
    }
    card.style.borderColor = "var(--accent)";
    card.innerHTML = `
      <p class="mono" style="color:var(--accent); font-size:12px">💧 Nota del coach · oggi</p>
      <p style="margin-top:8px">${testo}</p>
    `;
  } catch {
    card.remove();
  }
}

// "How was today?" — disponibile solo dopo la fine della sessione, solo per chi era
// presente (Presenza -> Allenamento -> Feedback). Una card per ogni sessione di questa
// settimana ancora senza feedback.
async function loadFeedbackDaDare(el) {
  const container = el.querySelector("#feedback-cards");
  try {
    const { sessioni } = await api.get("/feedback/da-dare");
    if (!sessioni.length) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = sessioni
      .map(
        (s) => `
          <div class="card" style="margin-top:12px" data-data="${s.data}" data-sessione="${s.sessioneId}">
            <p class="mono" style="color:var(--mute); font-size:12px">HOW WAS TODAY? · ${formattaData(s.data)}</p>
            <div style="display:flex; justify-content:space-between; margin-top:10px">
              ${FACCE.map(
                (f) => `
                  <button type="button" class="faccia-btn" data-valore="${f.valore}" title="${f.titolo}"
                    style="background:none; border:none; font-size:28px; cursor:pointer; padding:4px; border-radius:8px">
                    ${f.emoji}
                  </button>
                `
              ).join("")}
            </div>
            <input class="feedback-nota" type="text" placeholder="Nota facoltativa"
                   style="width:100%; margin-top:10px; background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:8px 10px; color:var(--text); font-size:13px" />
            <p class="error-text feedback-error" hidden style="margin-top:6px"></p>
          </div>
        `
      )
      .join("");

    container.querySelectorAll(".faccia-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const cardEl = btn.closest("[data-sessione]");
        const errorEl = cardEl.querySelector(".feedback-error");
        errorEl.hidden = true;
        cardEl.querySelectorAll(".faccia-btn").forEach((b) => (b.disabled = true));

        try {
          await api.post("/feedback", {
            sessioneId: Number(cardEl.dataset.sessione),
            data: cardEl.dataset.data,
            faccina: Number(btn.dataset.valore),
            nota: cardEl.querySelector(".feedback-nota").value,
          });
          loadFeedbackDaDare(el);
          loadProgresso(el);
        } catch (err) {
          errorEl.textContent = err instanceof ApiError ? err.message : "Errore imprevisto";
          errorEl.hidden = false;
          cardEl.querySelectorAll(".faccia-btn").forEach((b) => (b.disabled = false));
        }
      });
    });
  } catch {
    container.innerHTML = "";
  }
}

async function loadRichieste(el) {
  const card = el.querySelector("#richieste-card");
  try {
    const { sessione, aperte, inviata, conteggi } = await api.get("/richieste/oggi");

    if (!sessione) {
      card.remove();
      return;
    }

    const conteggiHtml = Object.keys(conteggi).length
      ? `<div style="margin-top:10px; display:flex; flex-wrap:wrap; gap:8px">
          ${Object.entries(conteggi)
            .map(([cat, n]) => `<span class="mono" style="font-size:12px; color:var(--mute)">${cat} (${n})</span>`)
            .join("")}
        </div>`
      : "";

    if (inviata) {
      card.innerHTML = `
        <p class="mono" style="color:var(--mute); font-size:13px">Richieste per l'allenamento</p>
        <p style="margin-top:8px">Richiesta inviata ✓</p>
        ${conteggiHtml}
      `;
      return;
    }

    if (!aperte) {
      card.innerHTML = `
        <p class="mono" style="color:var(--mute); font-size:13px">Richieste per l'allenamento</p>
        <p class="mono" style="color:var(--mute); margin-top:8px">Chiuse per oggi (aprono di nuovo domani).</p>
        ${conteggiHtml}
      `;
      return;
    }

    card.innerHTML = `
      <p class="mono" style="color:var(--mute); font-size:13px">Richieste per l'allenamento</p>
      <p class="mono" style="color:var(--mute); font-size:11px; margin-top:2px">Aperte fino alle 13:00 di oggi</p>
      <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:10px" id="categoria-scelte">
        ${CATEGORIE.map((c) => `<button type="button" class="btn categoria-btn" data-cat="${c}" style="background:var(--surface-2); padding:6px 10px; font-size:12px">${c}</button>`).join("")}
      </div>
      <input id="richiesta-testo" type="text" placeholder="Oppure scrivi una richiesta libera"
             style="width:100%; margin-top:10px; background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:10px 12px; color:var(--text)" />
      <p class="error-text" id="richiesta-error" hidden style="margin-top:6px"></p>
      <button class="btn" id="richiesta-submit" style="width:100%; margin-top:10px">Invia richiesta</button>
      ${conteggiHtml}
    `;

    let categoriaScelta = null;
    const bottoni = card.querySelectorAll(".categoria-btn");
    bottoni.forEach((b) => {
      b.addEventListener("click", () => {
        const giaAttivo = categoriaScelta === b.dataset.cat;
        bottoni.forEach((x) => (x.style.background = "var(--surface-2)"));
        categoriaScelta = giaAttivo ? null : b.dataset.cat;
        if (!giaAttivo) b.style.background = "var(--accent)";
      });
    });

    card.querySelector("#richiesta-submit").addEventListener("click", async (e) => {
      const errorEl = card.querySelector("#richiesta-error");
      const testoLibero = card.querySelector("#richiesta-testo").value;
      errorEl.hidden = true;
      e.target.disabled = true;
      try {
        await api.post("/richieste", { categoria: categoriaScelta, testoLibero });
        loadRichieste(el);
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

function anelliSvg({ training, challenges, feedback }) {
  const pctTraining = training.totali > 0 ? Math.min(1, training.fatti / training.totali) : 0;
  const pctChallenges = challenges.totali > 0 ? Math.min(1, challenges.fatte / challenges.totali) : 0;
  const pctFeedback = feedback.totali > 0 ? Math.min(1, feedback.fatti / feedback.totali) : 0;

  const anelli = [
    { r: 54, pct: pctTraining, colore: "var(--accent)" },
    { r: 40, pct: pctChallenges, colore: "var(--sessione-extra)" },
    { r: 26, pct: pctFeedback, colore: "var(--livello-1)" },
  ];

  const cerchi = anelli
    .map(({ r, pct, colore }) => {
      const circ = 2 * Math.PI * r;
      const dash = circ * pct;
      return `
        <circle cx="64" cy="64" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="9" />
        <circle cx="64" cy="64" r="${r}" fill="none" stroke="${colore}" stroke-width="9" stroke-linecap="round"
          stroke-dasharray="${circ}" stroke-dashoffset="${circ - dash}" transform="rotate(-90 64 64)" />
      `;
    })
    .join("");

  return `<svg width="128" height="128" viewBox="0 0 128 128">${cerchi}</svg>`;
}

async function loadProgresso(el) {
  const card = el.querySelector("#progresso-card");
  try {
    const { nome, nickname, anelli, livello } = await api.get("/profilo/me");

    const saluto = el.querySelector("#saluto-nome");
    if (saluto) saluto.textContent = nickname || nome || "Home";

    const legenda = `
      <div style="display:flex; flex-direction:column; gap:10px; justify-content:center">
        <div><span style="color:var(--accent)">●</span> <span class="mono">TRAINING</span> <strong>${anelli.training.fatti}/${anelli.training.totali}</strong></div>
        <div><span style="color:var(--sessione-extra)">●</span> <span class="mono">CHALLENGES</span> <strong>${anelli.challenges.fatte}/${anelli.challenges.totali}</strong></div>
        <div><span style="color:var(--livello-1)">●</span> <span class="mono">FEEDBACK</span> <strong>${anelli.feedback.fatti}/${anelli.feedback.totali}</strong></div>
      </div>
    `;

    const weekCompleteHtml = anelli.settimanaCompletata
      ? `<div style="margin-top:14px; text-align:center; padding:10px; border-radius:10px; border:1px solid var(--accent); box-shadow:0 0 16px -4px var(--accent)">
          <p style="font-weight:700; letter-spacing:1px">WEEK COMPLETE 🔥</p>
        </div>`
      : "";

    let livelloHtml = `<p class="mono" style="color:var(--mute); margin-top:14px">Nessun livello ancora — completa la tua prima settimana per iniziare.</p>`;
    if (livello) {
      const { attuale, prossimo, settimaneCompletate } = livello;
      const range = prossimo ? prossimo.settimaneMin - attuale.settimaneMin : 0;
      const progresso = prossimo ? settimaneCompletate - attuale.settimaneMin + 1 : range;
      const dots = prossimo
        ? Array.from({ length: range }, (_, i) => (i < progresso ? "●" : "○")).join(" ")
        : "";

      livelloHtml = `
        <div style="margin-top:14px; border-top:1px solid var(--border); padding-top:14px">
          <p style="font-weight:600; color:${attuale.colore}">Livello ${attuale.numero} — ${attuale.nome}</p>
          <p class="mono" style="color:var(--mute); font-size:13px; margin-top:4px">
            ${settimaneCompletate} settimane completate.
            ${prossimo ? `Ancora ${prossimo.settimaneMin - settimaneCompletate} per salire a ${prossimo.nome}.` : "Livello massimo raggiunto."}
          </p>
          ${dots ? `<p style="letter-spacing:3px; color:${attuale.colore}; margin-top:8px">${dots}</p>` : ""}
        </div>
      `;
    }

    card.innerHTML = `
      <p class="mono" style="color:var(--mute); font-size:13px; letter-spacing:1px">YOUR WEEK</p>
      <div style="display:flex; align-items:center; gap:20px; margin-top:10px">
        ${anelliSvg(anelli)}
        ${legenda}
      </div>
      ${weekCompleteHtml}
      ${livelloHtml}
    `;
  } catch {
    card.remove();
  }
}

async function loadPresenza(el) {
  const card = el.querySelector("#presenza-card");
  try {
    const { sessione, confermata, inSala } = await api.get("/presenze/oggi");

    if (!sessione) {
      card.innerHTML = `<p class="mono" style="color:var(--mute)">Oggi non c'è sessione. Riposo.</p>`;
      return;
    }

    card.innerHTML = `
      <p class="mono" style="color:var(--mute)">Oggi ${sessione.ora_inizio}–${sessione.ora_fine}</p>
      <button class="btn" id="conferma-btn" style="width:100%; margin-top:12px" ${confermata ? "disabled" : ""}>
        ${confermata ? "Presenza confermata ✓" : "Confermo che vengo"}
      </button>
      <div style="margin-top:16px">
        <p class="mono" style="color:var(--mute); font-size:13px">In sala oggi (${inSala.length})</p>
        <p>${inSala.length ? inSala.map((a) => a.nickname || a.nome).join(", ") : "Nessuno ancora"}</p>
      </div>
    `;

    if (!confermata) {
      card.querySelector("#conferma-btn").addEventListener("click", async (e) => {
        e.target.disabled = true;
        try {
          await api.post("/presenze/conferma");
          loadPresenza(el);
          loadProgresso(el);
        } catch (err) {
          e.target.disabled = false;
        }
      });
    }
  } catch (err) {
    card.innerHTML = `<p class="error-text">${err instanceof ApiError ? err.message : "Errore imprevisto"}</p>`;
  }
}
