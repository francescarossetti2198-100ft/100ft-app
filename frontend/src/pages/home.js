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

function nomeGiorno(dataIso) {
  const d = new Date(`${dataIso}T00:00:00Z`);
  return GIORNI[(d.getUTCDay() + 6) % 7];
}

function sezione(titolo, corpo) {
  return `<p class="mono" style="color:var(--mute); font-size:12px; letter-spacing:1px">${titolo}</p>${corpo}`;
}

export function renderHome(appEl) {
  const oggi = new Date();
  const el = document.createElement("div");
  el.className = "screen";
  el.innerHTML = `
    <h1 id="saluto-nome" style="letter-spacing:0.5px">&nbsp;</h1>
    <p class="mono" style="color:var(--mute); font-size:13px; letter-spacing:1px">
      ${GIORNI[(oggi.getDay() + 6) % 7].toUpperCase()} · ${oggi.getDate()} ${MESI[oggi.getMonth()].toUpperCase()}
    </p>
    <div class="card" id="settimana-card" style="margin-top:20px">
      <p class="mono" style="color:var(--mute)">Carico...</p>
    </div>
    <div class="card" id="timeline-card" style="margin-top:12px">
      <p class="mono" style="color:var(--mute)">Carico...</p>
    </div>
    <div class="card" id="coach-card" style="margin-top:12px"></div>
    <div id="richieste-card" class="card" style="margin-top:12px"></div>
    <div id="feedback-card" class="card" style="margin-top:12px"></div>
  `;
  appEl.appendChild(el);
  appEl.appendChild(renderTabbar());

  loadSettimana(el);
  loadTimeline(el);
  loadCoach(el);
  loadRichieste(el);
  loadFeedback(el);
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

// Sezione 2: LA TUA SETTIMANA — i 3 anelli + livello. Logica invariata, solo presentazione.
async function loadSettimana(el) {
  const card = el.querySelector("#settimana-card");
  try {
    const { nome, cognome, anelli, livello } = await api.get("/profilo/me");

    const saluto = el.querySelector("#saluto-nome");
    if (saluto) saluto.textContent = [nome, cognome].filter(Boolean).join(" ").toUpperCase();

    const legenda = `
      <div style="display:flex; flex-direction:column; gap:8px; justify-content:center">
        <div><span style="color:var(--accent)">●</span> Allenamenti <strong>${anelli.training.fatti}/${anelli.training.totali}</strong></div>
        <div><span style="color:var(--sessione-extra)">●</span> Sfide <strong>${anelli.challenges.fatte}/${anelli.challenges.totali}</strong></div>
        <div><span style="color:var(--livello-1)">●</span> Feedback <strong>${anelli.feedback.fatti}/${anelli.feedback.totali}</strong></div>
      </div>
    `;

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

    card.innerHTML = sezione(
      "LA TUA SETTIMANA",
      `
        <div style="display:flex; align-items:center; gap:16px; margin-top:10px">
          ${anelliSvg(anelli)}
          ${legenda}
        </div>
        ${livelloHtml}
      `
    );
  } catch {
    card.remove();
  }
}

// Sezione 3/4/5: QUESTA SETTIMANA — timeline verticale Lun/Mer/Ven, state-driven:
// passata+presente (✓), oggi da confermare (● + bottone CI SONO), futura (○, non cliccabile).
async function loadTimeline(el) {
  const card = el.querySelector("#timeline-card");
  try {
    const { sessioniSettimana } = await api.get("/profilo/me");
    const oggiIso = new Date().toISOString().slice(0, 10);

    const righe = sessioniSettimana
      .map((s) => {
        const giorno = nomeGiorno(s.data).toUpperCase();
        const orario = `${s.oraInizio} — ${s.oraFine}`;

        if (s.data < oggiIso) {
          return s.confermata
            ? `
              <div style="padding:12px 0; border-top:1px solid var(--border)">
                <p style="font-size:14px"><span style="color:var(--accent)">✓</span> ${giorno}</p>
                <p class="mono" style="color:var(--mute); font-size:12px; margin-top:2px">${orario}</p>
                <p class="mono" style="color:var(--accent); font-size:11px; letter-spacing:1px; margin-top:4px">PRESENTE</p>
              </div>
            `
            : `
              <div style="padding:12px 0; border-top:1px solid var(--border); opacity:0.6">
                <p style="font-size:14px">${giorno}</p>
                <p class="mono" style="color:var(--mute); font-size:12px; margin-top:2px">${orario}</p>
                <p class="mono" style="color:var(--mute); font-size:11px; letter-spacing:1px; margin-top:4px">NON FREQUENTATA</p>
              </div>
            `;
        }

        if (s.data > oggiIso) {
          return `
            <div style="padding:12px 0; border-top:1px solid var(--border); opacity:0.4">
              <p style="font-size:14px">○ ${giorno}</p>
              <p class="mono" style="font-size:12px; margin-top:2px">${orario}</p>
              <p class="mono" style="font-size:11px; letter-spacing:1px; margin-top:4px">DISPONIBILE PROSSIMAMENTE</p>
            </div>
          `;
        }

        // Oggi.
        if (s.confermata) {
          return `
            <div style="padding:12px 0; border-top:1px solid var(--border)">
              <p style="font-size:14px"><span style="color:var(--accent)">✓</span> ${giorno}</p>
              <p class="mono" style="color:var(--mute); font-size:12px; margin-top:2px">${orario}</p>
              <p class="mono" style="color:var(--accent); font-size:11px; letter-spacing:1px; margin-top:4px">PRESENTE</p>
            </div>
          `;
        }

        // Sessione di oggi già finita e mai confermata: non si può più segnare presente ora.
        const finita = new Date(`${s.data}T${s.oraFine}:00Z`) <= new Date();
        if (finita) {
          return `
            <div style="padding:12px 0; border-top:1px solid var(--border); opacity:0.6">
              <p style="font-size:14px">${giorno}</p>
              <p class="mono" style="color:var(--mute); font-size:12px; margin-top:2px">${orario}</p>
              <p class="mono" style="color:var(--mute); font-size:11px; letter-spacing:1px; margin-top:4px">NON FREQUENTATA</p>
            </div>
          `;
        }

        return `
          <div style="margin-top:12px; padding:14px; border-radius:12px; border:1px solid var(--accent)">
            <p style="font-size:15px; font-weight:600"><span style="color:var(--accent)">●</span> ${giorno}</p>
            <p class="mono" style="color:var(--mute); font-size:12px; margin-top:2px">${orario}</p>
            <p class="mono" style="font-size:11px; letter-spacing:1px; margin-top:8px">CONFERMA LA TUA PRESENZA</p>
            <button class="btn conferma-presenza-btn" data-sessione="${s.sessioneId}" style="width:100%; margin-top:10px">CI SONO</button>
          </div>
        `;
      })
      .join("");

    card.innerHTML = sezione("QUESTA SETTIMANA", `<div style="margin-top:4px">${righe}</div>`);

    card.querySelector(".conferma-presenza-btn")?.addEventListener("click", async (e) => {
      e.target.disabled = true;
      try {
        await api.post("/presenze/conferma");
        loadSettimana(el);
        loadTimeline(el);
        loadFeedback(el);
      } catch {
        e.target.disabled = false;
      }
    });
  } catch (err) {
    card.innerHTML = `<p class="error-text">${err instanceof ApiError ? err.message : "Errore imprevisto"}</p>`;
  }
}

// Sezione 6: INFO SULL'ALLENAMENTO DI OGGI — solo una frase introduttiva, mai il contenuto della lezione.
async function loadCoach(el) {
  const card = el.querySelector("#coach-card");
  try {
    const { testo } = await api.get("/nota-coach");
    card.innerHTML = sezione(
      "INFO SULL'ALLENAMENTO DI OGGI",
      testo
        ? `<p style="margin-top:8px; font-style:italic">"${testo}"</p>`
        : `<p class="mono" style="color:var(--mute); font-size:13px; margin-top:8px">Nessun messaggio della coach per oggi.</p>`
    );
  } catch {
    card.remove();
  }
}

// Sezione 7: RICHIESTA DELL'ALLIEVO — chiude alle 13:00, poi resta visibile ma non interattiva.
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
      card.innerHTML = sezione(
        "PRIMA DELL'ALLENAMENTO",
        `<p style="margin-top:8px">Richiesta inviata ✓</p>${conteggiHtml}`
      );
      return;
    }

    if (!aperte) {
      card.innerHTML = sezione(
        "PRIMA DELL'ALLENAMENTO",
        `
          <p style="margin-top:8px; font-weight:600">RICHIESTA CHIUSA</p>
          <p class="mono" style="color:var(--mute); font-size:13px; margin-top:4px">La coach vedrà la tua richiesta prima della sessione.</p>
        `
      );
      return;
    }

    card.innerHTML = sezione(
      "PRIMA DELL'ALLENAMENTO",
      `
        <p style="margin-top:8px">C'è qualcosa su cui vorresti lavorare oggi?</p>
        <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:10px" id="categoria-scelte">
          ${CATEGORIE.map((c) => `<button type="button" class="btn categoria-btn" data-cat="${c}" style="background:var(--surface-2); padding:6px 10px; font-size:12px; text-transform:uppercase">${c}</button>`).join("")}
        </div>
        <input id="richiesta-testo" type="text" placeholder="Oppure scrivi una richiesta libera"
               style="width:100%; margin-top:10px; background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:10px 12px; color:var(--text)" />
        <p class="error-text" id="richiesta-error" hidden style="margin-top:6px"></p>
        <button class="btn" id="richiesta-submit" style="width:100%; margin-top:10px">Invia richiesta</button>
        ${conteggiHtml}
      `
    );

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

// Sezione 8/9: FEEDBACK — bloccato prima della fine sessione, assente niente questionario,
// disponibile solo per chi era presente. Sempre visibile (card, non nascosta) nei giorni di sessione.
async function loadFeedback(el) {
  const card = el.querySelector("#feedback-card");
  try {
    const { sessione, confermata } = await api.get("/presenze/oggi");

    if (!sessione) {
      card.remove();
      return;
    }

    const finita = new Date(`${new Date().toISOString().slice(0, 10)}T${sessione.ora_fine}:00Z`) <= new Date();

    if (!finita) {
      card.innerHTML = sezione(
        "DOPO L'ALLENAMENTO",
        `<p style="margin-top:8px">🔒 <span class="mono" style="color:var(--mute); font-size:13px">Disponibile dopo la sessione</span></p>`
      );
      return;
    }

    if (!confermata) {
      card.innerHTML = sezione(
        "DOPO L'ALLENAMENTO",
        `<p class="mono" style="color:var(--mute); font-size:13px; margin-top:8px">SESSIONE NON FREQUENTATA</p>`
      );
      return;
    }

    const { sessioni } = await api.get("/feedback/da-dare");
    const daDare = sessioni.find((s) => s.sessioneId === sessione.id) ?? null;

    if (!daDare) {
      card.innerHTML = sezione("COM'È ANDATA OGGI?", `<p style="margin-top:8px">Feedback inviato ✓</p>`);
      return;
    }

    card.innerHTML = sezione(
      "COM'È ANDATA OGGI?",
      `
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
      `
    );

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
          loadFeedback(el);
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
