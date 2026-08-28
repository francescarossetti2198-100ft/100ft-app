import { renderTabbar } from "../components/tabbar.js";
import { logout } from "../auth.js";
import { navigate } from "../router.js";
import { api, ApiError, mediaUrl } from "../api.js";
import { statoNotifiche, attivaNotifiche, disattivaNotifiche, inviaNotificaDiProva } from "../push.js";

const MILESTONE_LABEL = {
  first_session: "Prima sessione 🎬",
  "10_sessions": "10 sessioni 🔟",
  "25_sessions": "25 sessioni 🏅",
  first_month: "Primo mese 📅",
  hydration_hero: "Hydration Hero 💧",
  team_player: "Team Player 🤝",
};

const CATEGORIA_LABEL = {
  Mobilità: "🧘 Mobilità",
  Gambe: "🦵 Gambe",
  "Parte superiore": "💪 Parte superiore",
  Altro: "✏️ Altro",
};

// Stessa scala fissa delle 5 faccine di feedback usata in Home (frontend/src/pages/home.js) —
// mai sostituita, stesso ordine.
const FACCINA_EMOJI = { 1: "😫", 2: "😕", 3: "😐", 4: "🙂", 5: "🔥" };

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

function giorniFa(dataIso) {
  const giorni = Math.round((Date.now() - new Date(`${dataIso}T00:00:00Z`).getTime()) / 86400000);
  if (giorni === 0) return "oggi";
  if (giorni === 1) return "ieri";
  return `${giorni}gg fa`;
}

function pagamentoBadgeHtml(userId, stato) {
  const pagato = stato === "pagato";
  const colore = pagato ? "var(--livello-1)" : "var(--livello-5)";
  return `
    <button type="button" class="link-btn pagamento-toggle" data-user-id="${userId}" data-stato="${stato}"
      style="text-decoration:none; color:${colore}; font-family:var(--font-mono); font-size:11px; letter-spacing:1px">
      ${pagato ? "PAGATO ✓" : "DA PAGARE"}
    </button>
  `;
}

// Blocco foto profilo — usato sia dall'atleta sia dalla coach (il backend accetta la foto
// per entrambi, e compare in classifica accanto al nome). L'input è nascosto visivamente
// invece che con l'attributo `hidden`: su iOS Safari un file input con `hidden` a volte non
// apre il selettore quando viene attivato dalla label.
function fotoProfiloHtml(fotoUrl, iniziale) {
  return `
    <div style="text-align:center">
      <label for="foto-input" style="cursor:pointer; display:inline-block">
        ${
          fotoUrl
            ? `<img src="${mediaUrl(fotoUrl)}" alt="Foto profilo" style="width:84px; height:84px; border-radius:50%; object-fit:cover; border:2px solid var(--border)" />`
            : `<span style="width:84px; height:84px; border-radius:50%; background:var(--surface-2); display:flex; align-items:center; justify-content:center; font-size:28px; color:var(--mute)">${iniziale}</span>`
        }
        <p class="mono link-btn" style="margin-top:6px; font-size:12px">${fotoUrl ? "Cambia foto" : "Aggiungi una foto"}</p>
      </label>
      <input id="foto-input" type="file" accept="image/*"
             style="position:absolute; width:1px; height:1px; opacity:0; overflow:hidden" />
      <p class="error-text" id="foto-error" hidden style="margin-top:4px"></p>
    </div>
  `;
}

function attachFotoUpload(container, onDone) {
  const input = container.querySelector("#foto-input");
  if (!input) return;
  input.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const errorEl = container.querySelector("#foto-error");
    errorEl.hidden = true;
    try {
      const formData = new FormData();
      formData.append("foto", file);
      await api.postForm("/profilo/foto", formData);
      onDone();
    } catch (err) {
      errorEl.textContent = err instanceof ApiError ? err.message : "Errore imprevisto";
      errorEl.hidden = false;
    }
  });
}

// Profilo coach: non è la copia di quello atleta (niente livello/scala/achievements, la
// coach non si allena) — è lo STATO ABBONAMENTI, l'elenco allievi con presenze/livello/
// feedback/richieste recenti e lo stato di pagamento del mese, segnabile al volo.
function renderProfiloCoach(content, p, onFotoCaricata) {
  content.innerHTML = `
    <div class="card" style="margin-bottom:12px">${fotoProfiloHtml(p?.fotoUrl, "C")}</div>
    <p class="mono" style="color:var(--mute); font-size:12px; letter-spacing:1px">STATO ABBONAMENTI</p>
    <div class="card" style="margin-top:10px" id="abbonamenti-list"><p class="mono" style="color:var(--mute)">Carico...</p></div>
  `;

  attachFotoUpload(content, onFotoCaricata ?? (() => {}));

  const list = content.querySelector("#abbonamenti-list");

  function carica() {
    api
      .get("/atleti")
      .then(({ atleti }) => {
        if (!atleti.length) {
          list.innerHTML = `<p class="mono" style="color:var(--mute); font-size:13px">Nessun atleta ancora.</p>`;
          return;
        }

        list.innerHTML = atleti
          .map((a, i) => {
            const nome = a.nickname || `${a.nome} ${a.cognome}`.trim();
            const livelloHtml = a.livello
              ? `<span class="mono" style="color:${a.livello.attuale.colore}">Livello ${a.livello.attuale.numero}</span>`
              : `<span class="mono" style="color:var(--mute)">Nessun livello</span>`;
            const feedbackHtml = a.ultimoFeedback
              ? `${FACCINA_EMOJI[a.ultimoFeedback.faccina]} · ${giorniFa(a.ultimoFeedback.data)}`
              : "Nessun feedback";
            const richiesteHtml = a.richiesteRecenti.length
              ? a.richiesteRecenti
                  .map((r) => r.categoria ? (CATEGORIA_LABEL[r.categoria] ?? r.categoria) : (r.testoLibero ?? ""))
                  .filter(Boolean)
                  .join(" · ")
              : "";

            return `
              <div style="${i === 0 ? "" : "border-top:1px solid var(--border);"} padding:10px 0">
                <div style="display:flex; justify-content:space-between; align-items:baseline">
                  <p style="font-size:14px; font-weight:600">${nome}</p>
                  ${livelloHtml}
                </div>
                <p class="mono" style="color:var(--mute); font-size:12px; margin-top:4px">
                  ${a.presenzeUltime4Settimane} presenze (28gg) · ${feedbackHtml}
                </p>
                ${richiesteHtml ? `<p class="mono" style="color:var(--mute); font-size:12px; margin-top:2px">${richiesteHtml}</p>` : ""}
                <div style="margin-top:6px; display:flex; gap:14px; align-items:center; flex-wrap:wrap">
                  ${pagamentoBadgeHtml(a.userId, a.pagamentoMese)}
                  <button type="button" class="link-btn reset-password-btn" data-user-id="${a.userId}" data-nome="${nome.replace(/"/g, "&quot;")}"
                    style="text-decoration:none; color:var(--mute); font-family:var(--font-mono); font-size:11px; letter-spacing:1px">
                    RESET PASSWORD
                  </button>
                </div>
                <div class="reset-password-esito" data-user-id="${a.userId}" style="margin-top:6px"></div>
              </div>
            `;
          })
          .join("");

        list.querySelectorAll(".pagamento-toggle").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const nuovoStato = btn.dataset.stato === "pagato" ? "non_pagato" : "pagato";
            btn.disabled = true;
            try {
              await api.post("/pagamenti", { userId: Number(btn.dataset.userId), stato: nuovoStato });
              carica();
            } catch {
              btn.disabled = false;
            }
          });
        });

        list.querySelectorAll(".reset-password-btn").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const userId = Number(btn.dataset.userId);
            const nome = btn.dataset.nome;
            if (!confirm(`Reimpostare la password di ${nome}? Verrà disconnesso da tutti i dispositivi.`)) return;
            const esito = list.querySelector(`.reset-password-esito[data-user-id="${userId}"]`);
            btn.disabled = true;
            try {
              const { passwordTemporanea } = await api.post(`/atleti/${userId}/reset-password`);
              esito.innerHTML = `
                <p class="mono" style="font-size:12px; color:var(--text)">
                  Password temporanea: <strong style="letter-spacing:1px">${passwordTemporanea}</strong>
                </p>
                <p class="mono" style="font-size:11px; color:var(--mute); margin-top:2px">
                  Comunicagliela: potrà cambiarla dal suo Profilo → Sicurezza.
                </p>
              `;
            } catch (err) {
              esito.innerHTML = `<p class="error-text">${err instanceof ApiError ? err.message : "Errore imprevisto"}</p>`;
            } finally {
              btn.disabled = false;
            }
          });
        });
      })
      .catch((err) => {
        list.innerHTML = `<p class="error-text">${err instanceof ApiError ? err.message : "Errore imprevisto"}</p>`;
      });
  }

  carica();
}

function sicurezzaCardHtml() {
  return `
    <div class="card" style="margin-top:12px" id="sicurezza-card">
      <p class="mono" style="color:var(--mute); font-size:12px">SICUREZZA</p>
      <button class="link-btn" id="apri-cambio-password" style="margin-top:8px">Cambia password</button>
      <form id="cambio-password-form" hidden style="margin-top:12px">
        <div class="field">
          <label for="pw-attuale">Password attuale</label>
          <input id="pw-attuale" type="password" autocomplete="current-password" required />
        </div>
        <div class="field">
          <label for="pw-nuova">Nuova password</label>
          <input id="pw-nuova" type="password" autocomplete="new-password" minlength="8" required />
        </div>
        <div class="field">
          <label for="pw-conferma">Conferma nuova password</label>
          <input id="pw-conferma" type="password" autocomplete="new-password" minlength="8" required />
        </div>
        <p class="error-text" id="pw-error" hidden></p>
        <p class="success-text" id="pw-success" hidden>Password aggiornata.</p>
        <button class="btn" type="submit" style="width:100%">Salva nuova password</button>
      </form>
    </div>
  `;
}

function initSicurezza(content) {
  const card = content.querySelector("#sicurezza-card");
  if (!card) return;
  const apri = card.querySelector("#apri-cambio-password");
  const form = card.querySelector("#cambio-password-form");
  const errorEl = card.querySelector("#pw-error");
  const successEl = card.querySelector("#pw-success");

  apri.addEventListener("click", () => {
    form.hidden = !form.hidden;
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    successEl.hidden = true;
    const attuale = card.querySelector("#pw-attuale").value;
    const nuova = card.querySelector("#pw-nuova").value;
    const conferma = card.querySelector("#pw-conferma").value;

    if (nuova !== conferma) {
      errorEl.textContent = "Le nuove password non coincidono";
      errorEl.hidden = false;
      return;
    }

    const submitBtn = form.querySelector("button[type=submit]");
    submitBtn.disabled = true;
    try {
      await api.post("/auth/change-password", { attuale, nuova });
      form.reset();
      successEl.hidden = false;
    } catch (err) {
      errorEl.textContent = err instanceof ApiError ? err.message : "Errore imprevisto";
      errorEl.hidden = false;
    } finally {
      submitBtn.disabled = false;
    }
  });
}

async function initNotifiche(content) {
  const box = content.querySelector("#notifiche-stato");
  const stato = await statoNotifiche().catch(() => "non-supportato");

  if (stato === "non-supportato") {
    box.innerHTML = `<p class="mono" style="color:var(--mute); font-size:13px">Non disponibili su questo dispositivo/browser — su iPhone serve aver aggiunto l'app alla schermata Home da Safari.</p>`;
    return;
  }
  if (stato === "negato") {
    box.innerHTML = `<p class="mono" style="color:var(--mute); font-size:13px">Bloccate dalle impostazioni del telefono — vanno riattivate da lì per questa app.</p>`;
    return;
  }

  box.innerHTML =
    stato === "attive"
      ? `<p style="font-size:13px">Attive ✓</p>
         <button class="btn" id="notifiche-prova" style="width:100%; margin-top:8px">Invia notifica di prova</button>
         <p class="mono" id="notifiche-prova-esito" style="font-size:12px; color:var(--mute); margin-top:6px" hidden></p>
         <button class="btn" id="notifiche-toggle" style="width:100%; margin-top:8px; background:var(--surface-2); color:var(--text)">Disattiva</button>`
      : `<p class="mono" style="color:var(--mute); font-size:13px">Ricevi un avviso quando arriva il Daily Drop e il promemoria del giorno di allenamento.</p>
         <button class="btn" id="notifiche-toggle" style="width:100%; margin-top:8px">Attiva notifiche</button>`;

  content.querySelector("#notifiche-toggle").addEventListener("click", async (e) => {
    e.target.disabled = true;
    try {
      if (stato === "attive") await disattivaNotifiche();
      else await attivaNotifiche();
      initNotifiche(content);
    } catch (err) {
      box.innerHTML = `<p class="error-text">${err.message}</p>`;
    }
  });

  const prova = content.querySelector("#notifiche-prova");
  if (prova) {
    prova.addEventListener("click", async () => {
      const esito = content.querySelector("#notifiche-prova-esito");
      prova.disabled = true;
      esito.hidden = false;
      esito.textContent = "Invio…";
      try {
        await inviaNotificaDiProva();
        esito.textContent = "Inviata — dovrebbe arrivarti tra pochi secondi.";
      } catch (err) {
        esito.textContent = err instanceof ApiError ? err.message : "Errore nell'invio";
      } finally {
        prova.disabled = false;
      }
    });
  }
}

async function loadProfilo(el) {
  const content = el.querySelector("#profilo-content");
  try {
    const p = await api.get("/profilo/me");

    if (p.role === "coach") {
      renderProfiloCoach(content, p, () => loadProfilo(el));
      return;
    }

    const nomeVisualizzato = p.nickname || p.nome || "Atleta";

    const fotoHtml = fotoProfiloHtml(p.fotoUrl, nomeVisualizzato[0]?.toUpperCase() ?? "?");

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
          <p style="font-weight:600; font-size:18px">${p.classificaTotale.posizione}° / ${p.classificaTotale.totaleAtleti}</p>
          <p class="mono" style="color:var(--mute); font-size:12px">Classifica</p>
        </div>
      </div>
    `;

    const achievementsCard = `
      <div class="card" style="margin-top:12px">
        <p class="mono" style="color:var(--mute); font-size:12px">Achievements</p>
        <div style="margin-top:8px">${achievementsHtml(p.milestones)}</div>
      </div>
    `;

    const notificheCard = `
      <div class="card" style="margin-top:12px" id="notifiche-card">
        <p class="mono" style="color:var(--mute); font-size:12px">NOTIFICHE PUSH</p>
        <div id="notifiche-stato" style="margin-top:8px"><p class="mono" style="color:var(--mute); font-size:13px">Verifico...</p></div>
      </div>
    `;

    const sicurezzaCard = sicurezzaCardHtml();

    if (!p.livello) {
      content.innerHTML = `
        <div class="card">
          ${fotoHtml}
          <p style="font-weight:600; margin-top:10px; text-align:center">${nomeVisualizzato} ${p.cognome ?? ""}</p>
          <p class="mono" style="color:var(--mute); margin-top:8px">
            Nessun livello ancora — completa la tua prima settimana (Training + Challenges + Feedback) per sbloccarlo.
          </p>
        </div>
        ${statsHtml}
        ${achievementsCard}
        ${notificheCard}
        ${sicurezzaCard}
      `;
    } else {
      const { attuale } = p.livello;
      content.innerHTML = `
        <div class="card">
          ${fotoHtml}
          <p style="font-weight:600; margin-top:10px; text-align:center">${nomeVisualizzato} ${p.cognome ?? ""}</p>
          <p class="mono" style="color:${attuale.colore}; font-size:13px; margin-top:4px; text-align:center">Livello ${attuale.numero} — ${attuale.nome}</p>
        </div>
        <div class="card" style="margin-top:12px; text-align:center">
          <img src="/cards/card_final_${attuale.numero}.png" alt="Livello ${attuale.numero}"
               style="width:120px; height:120px; border-radius:12px; object-fit:cover" />
          <p class="mono" style="color:var(--mute); font-size:12px; margin-top:10px">Scala livelli</p>
          <div style="margin-top:8px">${scalaLivelliHtml(p.livello)}</div>
        </div>
        ${statsHtml}
        ${achievementsCard}
        ${notificheCard}
        ${sicurezzaCard}
      `;
    }

    attachFotoUpload(content, () => loadProfilo(el));

    initNotifiche(content);
    initSicurezza(content);
  } catch (err) {
    content.innerHTML = `<p class="error-text">${err instanceof ApiError ? err.message : "Errore imprevisto"}</p>`;
  }
}
