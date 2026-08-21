import { renderTabbar } from "../components/tabbar.js";
import { api, ApiError } from "../api.js";

const CATEGORIE = ["Legs", "Mobility", "Upper Body", "Conditioning", "Other"];

export function renderHome(appEl) {
  const el = document.createElement("div");
  el.className = "screen";
  el.innerHTML = `
    <h1>Home</h1>
    <div class="card" id="progresso-card" style="margin-top:12px">
      <p class="mono" style="color:var(--mute)">Carico...</p>
    </div>
    <div class="card" id="nota-coach-card" style="margin-top:12px"></div>
    <div class="card" id="presenza-card" style="margin-top:12px">
      <p class="mono" style="color:var(--mute)">Carico...</p>
    </div>
    <div class="card" id="richieste-card" style="margin-top:12px"></div>
  `;
  appEl.appendChild(el);
  appEl.appendChild(renderTabbar());

  loadPresenza(el);
  loadProgresso(el);
  loadNotaCoach(el);
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
