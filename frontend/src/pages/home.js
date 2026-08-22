import { renderTabbar } from "../components/tabbar.js";
import { api, ApiError } from "../api.js";

const CATEGORIE = ["Mobilità", "Gambe", "Parte superiore", "Altro"];

// Scala fissa del feedback "Com'è andata oggi?" — sempre queste 5 faccine, in quest'ordine,
// mai sostituite con stelle, slider, numeri o altre emoji.
const FACCE = [
  { valore: 1, emoji: "😫", titolo: "Pessima giornata" },
  { valore: 2, emoji: "😕", titolo: "Non benissimo" },
  { valore: 3, emoji: "😐", titolo: "Nella media" },
  { valore: 4, emoji: "🙂", titolo: "Andata bene" },
  { valore: 5, emoji: "🔥", titolo: "Fantastico" },
];

const GIORNI = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
const MESI = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

function formattaGiornoOra(dataIso, oraInizio, oraFine) {
  const d = new Date(`${dataIso}T00:00:00Z`);
  const giorno = GIORNI[(d.getUTCDay() + 6) % 7];
  return `${giorno} ${oraInizio}–${oraFine}`;
}

export function renderHome(appEl) {
  const oggi = new Date();
  const el = document.createElement("div");
  el.className = "screen";
  el.innerHTML = `
    <h1 id="saluto-nome">&nbsp;</h1>
    <p class="mono" style="color:var(--mute); font-size:13px; letter-spacing:1px">
      ${GIORNI[(oggi.getDay() + 6) % 7].toUpperCase()} · ${oggi.getDate()} ${MESI[oggi.getMonth()].toUpperCase()}
    </p>
    <div class="card" id="settimana-card" style="margin-top:16px">
      <p class="mono" style="color:var(--mute)">Carico...</p>
    </div>
    <div class="card" id="oggi-card" style="margin-top:12px">
      <p class="mono" style="color:var(--mute)">Carico...</p>
    </div>
    <div id="richieste-card" class="card" style="margin-top:12px"></div>
  `;
  appEl.appendChild(el);
  appEl.appendChild(renderTabbar());

  loadSettimana(el);
  loadOggi(el);
  loadRichieste(el);
}

function anelliSvg({ training, challenges, feedback }) {
  const pctTraining = training.totali > 0 ? Math.min(1, training.fatti / training.totali) : 0;
  const pctChallenges = challenges.totali > 0 ? Math.min(1, challenges.fatte / challenges.totali) : 0;
  const pctFeedback = feedback.totali > 0 ? Math.min(1, feedback.fatti / feedback.totali) : 0;

  const anelli = [
    { r: 42, pct: pctTraining, colore: "var(--accent)" },
    { r: 31, pct: pctChallenges, colore: "var(--sessione-extra)" },
    { r: 20, pct: pctFeedback, colore: "var(--livello-1)" },
  ];

  const cerchi = anelli
    .map(({ r, pct, colore }) => {
      const circ = 2 * Math.PI * r;
      const dash = circ * pct;
      return `
        <circle cx="50" cy="50" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="7" />
        <circle cx="50" cy="50" r="${r}" fill="none" stroke="${colore}" stroke-width="7" stroke-linecap="round"
          stroke-dasharray="${circ}" stroke-dashoffset="${circ - dash}" transform="rotate(-90 50 50)" />
      `;
    })
    .join("");

  return `<svg width="100" height="100" viewBox="0 0 100 100">${cerchi}</svg>`;
}

async function loadSettimana(el) {
  const card = el.querySelector("#settimana-card");
  try {
    const { nome, nickname, anelli, livello, sessioniSettimana } = await api.get("/profilo/me");

    const saluto = el.querySelector("#saluto-nome");
    if (saluto) saluto.textContent = (nickname || nome || "").toUpperCase();

    const legenda = `
      <div style="display:flex; flex-direction:column; gap:8px; justify-content:center">
        <div><span style="color:var(--accent)">●</span> Allenamenti <strong>${anelli.training.fatti}/${anelli.training.totali}</strong></div>
        <div><span style="color:var(--sessione-extra)">●</span> Sfide <strong>${anelli.challenges.fatte}/${anelli.challenges.totali}</strong></div>
        <div><span style="color:var(--livello-1)">●</span> Feedback <strong>${anelli.feedback.fatti}/${anelli.feedback.totali}</strong></div>
      </div>
    `;

    const checklistHtml = `
      <div style="margin-top:14px; display:flex; flex-direction:column; gap:4px">
        ${sessioniSettimana
          .map(
            (s) => `
              <div style="display:flex; justify-content:space-between; font-size:13px">
                <span class="mono" style="color:var(--mute)">${formattaGiornoOra(s.data, s.oraInizio, s.oraFine)}</span>
                <span style="color:var(--accent)">${s.confermata ? "presente ✓" : ""}</span>
              </div>
            `
          )
          .join("")}
      </div>
    `;

    const weekCompleteHtml = anelli.settimanaCompletata
      ? `<div style="margin-top:14px; text-align:center; padding:8px; border-radius:10px; border:1px solid var(--accent); box-shadow:0 0 16px -4px var(--accent)">
          <p style="font-weight:700; letter-spacing:1px; font-size:14px">SETTIMANA COMPLETATA 🔥</p>
        </div>`
      : "";

    let livelloHtml = "";
    if (livello) {
      const { attuale, prossimo, settimaneCompletate } = livello;
      const range = prossimo ? prossimo.settimaneMin - attuale.settimaneMin : 0;
      const progresso = prossimo ? settimaneCompletate - attuale.settimaneMin + 1 : range;
      const pctBarra = prossimo ? Math.round((progresso / range) * 100) : 100;

      livelloHtml = `
        <div style="margin-top:14px; padding-top:12px; border-top:1px solid var(--border)">
          <p class="mono" style="color:var(--mute); font-size:11px">
            ${settimaneCompletate} SETTIMANE COMPLETATE · <span style="color:${attuale.colore}">LIVELLO ${attuale.numero} · ${attuale.nome.toUpperCase()}</span>
          </p>
          <div style="background:var(--surface-2); border-radius:4px; height:4px; margin-top:6px; overflow:hidden">
            <div style="background:${attuale.colore}; width:${pctBarra}%; height:100%"></div>
          </div>
        </div>
      `;
    }

    card.innerHTML = `
      <p class="mono" style="color:var(--mute); font-size:12px; letter-spacing:1px">LA TUA SETTIMANA</p>
      <div style="display:flex; align-items:center; gap:16px; margin-top:10px">
        ${anelliSvg(anelli)}
        ${legenda}
      </div>
      ${checklistHtml}
      ${weekCompleteHtml}
      ${livelloHtml}
    `;
  } catch {
    card.remove();
  }
}

async function loadOggi(el) {
  const card = el.querySelector("#oggi-card");
  try {
    const { sessione, confermata } = await api.get("/presenze/oggi");

    if (!sessione) {
      card.remove();
      return;
    }

    if (!confermata) {
      card.innerHTML = `
        <p class="mono" style="color:var(--mute); font-size:12px; letter-spacing:1px">OGGI</p>
        <p class="mono" style="color:var(--mute); font-size:13px; margin-top:6px">${sessione.ora_inizio} · SESSIONE</p>
        <p style="font-weight:600; margin-top:10px">Partecipi oggi?</p>
        <button class="btn" id="conferma-btn" style="width:100%; margin-top:10px">Sì, ci sono</button>
      `;
      card.querySelector("#conferma-btn").addEventListener("click", async (e) => {
        e.target.disabled = true;
        try {
          await api.post("/presenze/conferma");
          loadOggi(el);
          loadSettimana(el);
        } catch {
          e.target.disabled = false;
        }
      });
      return;
    }

    // Presente: se la sessione è già finita, verifica se manca ancora il feedback di oggi.
    const finita = new Date(`${new Date().toISOString().slice(0, 10)}T${sessione.ora_fine}:00Z`) <= new Date();
    let daDare = null;
    if (finita) {
      const { sessioni } = await api.get("/feedback/da-dare");
      daDare = sessioni.find((s) => s.sessioneId === sessione.id) ?? null;
    }

    if (!finita || !daDare) {
      card.innerHTML = `
        <p class="mono" style="color:var(--mute); font-size:12px; letter-spacing:1px">OGGI</p>
        <p class="mono" style="color:var(--mute); font-size:13px; margin-top:6px">${sessione.ora_inizio} · SESSIONE</p>
        <p style="margin-top:10px">🟢 <strong>Presente</strong>${finita ? " · Feedback ✓" : ""}</p>
      `;
      return;
    }

    card.innerHTML = `
      <p class="mono" style="color:var(--mute); font-size:12px; letter-spacing:1px">COM'È ANDATA OGGI?</p>
      <div style="display:flex; justify-content:space-between; margin-top:12px">
        ${FACCE.map(
          (f) => `
            <button type="button" class="faccia-btn" data-valore="${f.valore}" title="${f.titolo}"
              style="background:none; border:none; font-size:30px; cursor:pointer; padding:4px; border-radius:8px">
              ${f.emoji}
            </button>
          `
        ).join("")}
      </div>
      <input id="feedback-nota" type="text" placeholder="Nota facoltativa"
             style="width:100%; margin-top:10px; background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:8px 10px; color:var(--text); font-size:13px" />
      <p class="error-text" id="feedback-error" hidden style="margin-top:6px"></p>
    `;

    card.querySelectorAll(".faccia-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const errorEl = card.querySelector("#feedback-error");
        errorEl.hidden = true;
        card.querySelectorAll(".faccia-btn").forEach((b) => (b.disabled = true));

        try {
          await api.post("/feedback", {
            sessioneId: sessione.id,
            data: daDare.data,
            faccina: Number(btn.dataset.valore),
            nota: card.querySelector("#feedback-nota").value,
          });
          loadOggi(el);
          loadSettimana(el);
        } catch (err) {
          errorEl.textContent = err instanceof ApiError ? err.message : "Errore imprevisto";
          errorEl.hidden = false;
          card.querySelectorAll(".faccia-btn").forEach((b) => (b.disabled = false));
        }
      });
    });
  } catch (err) {
    card.innerHTML = `<p class="error-text">${err instanceof ApiError ? err.message : "Errore imprevisto"}</p>`;
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
        <p class="mono" style="color:var(--mute); font-size:12px; letter-spacing:1px">PRIMA DELL'ALLENAMENTO</p>
        <p style="margin-top:8px">Richiesta inviata ✓</p>
        ${conteggiHtml}
      `;
      return;
    }

    if (!aperte) {
      card.remove();
      return;
    }

    card.innerHTML = `
      <p class="mono" style="color:var(--mute); font-size:12px; letter-spacing:1px">PRIMA DELL'ALLENAMENTO</p>
      <p style="margin-top:8px">C'è qualcosa su cui vorresti lavorare oggi?</p>
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
