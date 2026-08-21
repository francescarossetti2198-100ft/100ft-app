import { renderTabbar } from "../components/tabbar.js";
import { api, ApiError } from "../api.js";

// TODO: nota del coach, richieste pre-allenamento (brief, sezione 7) — non ancora costruite.
export function renderHome(appEl) {
  const el = document.createElement("div");
  el.className = "screen";
  el.innerHTML = `
    <h1>Home</h1>
    <div class="card" id="progresso-card" style="margin-top:12px">
      <p class="mono" style="color:var(--mute)">Carico...</p>
    </div>
    <div class="card" id="presenza-card" style="margin-top:12px">
      <p class="mono" style="color:var(--mute)">Carico...</p>
    </div>
  `;
  appEl.appendChild(el);
  appEl.appendChild(renderTabbar());

  loadPresenza(el);
  loadProgresso(el);
}

function anelliSvg({ allenamenti, sfide, streakSettimane }) {
  const pctAllenamenti = allenamenti.totali > 0 ? Math.min(1, allenamenti.fatti / allenamenti.totali) : 0;
  const pctSfide = sfide.totali > 0 ? Math.min(1, sfide.fatte / sfide.totali) : 0;
  // Lo streak non ha un "totale" naturale: scala decorativa fino a 8 settimane per riempire l'anello.
  const pctStreak = Math.min(1, streakSettimane / 8);

  const anelli = [
    { r: 54, pct: pctAllenamenti, colore: "var(--accent)" },
    { r: 40, pct: pctSfide, colore: "var(--sessione-extra)" },
    { r: 26, pct: pctStreak, colore: "var(--livello-1)" },
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
    const { anelli, livello } = await api.get("/profilo/me");

    const legenda = `
      <div style="display:flex; flex-direction:column; gap:10px; justify-content:center">
        <div><span style="color:var(--accent)">●</span> Allenamenti <strong>${anelli.allenamenti.fatti}/${anelli.allenamenti.totali}</strong></div>
        <div><span style="color:var(--sessione-extra)">●</span> Sfide <strong>${anelli.sfide.fatte}/${anelli.sfide.totali}</strong></div>
        <div><span style="color:var(--livello-1)">●</span> Streak <strong>${anelli.streakSettimane} sett.</strong></div>
      </div>
    `;

    let livelloHtml = `<p class="mono" style="color:var(--mute); margin-top:14px">Nessun livello ancora — chiudi l'anello allenamenti questa settimana per iniziare.</p>`;
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
            ${settimaneCompletate} settimane totali con l'anello allenamenti chiuso.
            ${prossimo ? `Ancora ${prossimo.settimaneMin - settimaneCompletate} per salire a ${prossimo.nome}.` : "Livello massimo raggiunto."}
          </p>
          ${dots ? `<p style="letter-spacing:3px; color:${attuale.colore}; margin-top:8px">${dots}</p>` : ""}
        </div>
      `;
    }

    card.innerHTML = `
      <p class="mono" style="color:var(--mute); font-size:13px">Questa settimana</p>
      <div style="display:flex; align-items:center; gap:20px; margin-top:10px">
        ${anelliSvg(anelli)}
        ${legenda}
      </div>
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
