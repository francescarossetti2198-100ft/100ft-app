import { renderTabbar } from "../components/tabbar.js";
import { logout } from "../auth.js";
import { navigate } from "../router.js";
import { api, ApiError, mediaUrl } from "../api.js";
import { statoNotifiche, attivaNotifiche, disattivaNotifiche } from "../push.js";
import { costruisciQuestionario, riassuntoRisposte } from "../components/questionario.js";
import { FEEDBACK_MENSILE_DOMANDE } from "../feedback-mensile-domande.js";
import { etichettaCategoria } from "../richieste-categorie.js";
import { trofeiRigaHtml } from "../trofei.js";

const MILESTONE_LABEL = {
  first_session: "Prima sessione 🎬",
  "10_sessions": "10 sessioni 🔟",
  "25_sessions": "25 sessioni 🏅",
  first_month: "Primo mese 📅",
  hydration_hero: "Hydration Hero 💧",
  team_player: "Team Player 🤝",
};

// Stessa scala fissa delle 5 faccine di feedback usata in Home (frontend/src/pages/home.js) —
// mai sostituita, stesso ordine.
const FACCINA_EMOJI = { 1: "😫", 2: "😕", 3: "😐", 4: "🙂", 5: "🔥" };

const DIFFICOLTA_LABEL = {
  facile: "Facile",
  giusto: "Giusto",
  impegnativo: "Impegnativo",
  tostissimo: "Tostissimo",
};

const MESI = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];

// Testo libero scritto dall'atleta (note infortuni, nota feedback, ecc.): va inserito
// nell'HTML come testo, non come markup.
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function formatDataNascita(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d || m > 12) return null;
  return `${d} ${MESI[m - 1]} ${y}`;
}

function calcolaEta(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const n = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(n.getTime())) return null;
  const o = new Date();
  let e = o.getFullYear() - n.getFullYear();
  const mm = o.getMonth() - n.getMonth();
  if (mm < 0 || (mm === 0 && o.getDate() < n.getDate())) e--;
  return e >= 0 && e < 150 ? e : null;
}

// ────────────────────────────────────────────────────────────────────────────
// "Personalizza il tuo profilo" — questionario a risposta guidata (mai testo libero).
//
// ⚠️ SEGNAPOSTO: Francesca fornirà le domande definitive. Per sostituirle basta
// riscrivere QUESTO array — salvataggio, riassunto e rendering non cambiano.
// Ogni voce: { id, testo, tipo: "singola" | "multipla", max?, opzioni: [{ v, label }] }.
// Risposte salvate: { [id]: "v" }  (singola)  |  { [id]: ["v1","v2"] }  (multipla).
// ────────────────────────────────────────────────────────────────────────────
const PERSONALIZZAZIONE_DOMANDE = [
  {
    id: "obiettivo",
    testo: "Qual è il tuo obiettivo principale?",
    tipo: "singola",
    opzioni: [
      { v: "forma", label: "Rimettermi in forma" },
      { v: "peso", label: "Perdere peso" },
      { v: "massa", label: "Aumentare la massa muscolare" },
      { v: "forza", label: "Diventare più forte" },
      { v: "mobilita", label: "Migliorare mobilità e flessibilità" },
      { v: "resistenza", label: "Più fiato e resistenza" },
      { v: "benessere", label: "Scaricare lo stress e stare bene" },
    ],
  },
  {
    id: "esperienza",
    testo: "Da quanto ti alleni con costanza?",
    tipo: "singola",
    opzioni: [
      { v: "inizio", label: "Sto ricominciando adesso" },
      { v: "mesi", label: "Da qualche mese" },
      { v: "anni", label: "Da un paio d'anni" },
      { v: "sempre", label: "Da sempre" },
    ],
  },
  {
    id: "frequenza",
    testo: "Quante volte a settimana vuoi allenarti?",
    tipo: "singola",
    opzioni: [
      { v: "1", label: "1 volta" },
      { v: "2", label: "2 volte" },
      { v: "3", label: "3 volte" },
      { v: "4+", label: "4 o più" },
    ],
  },
  {
    id: "focus",
    testo: "Su quali aree vuoi concentrarti?",
    tipo: "multipla",
    max: 2,
    opzioni: [
      { v: "upper", label: "Parte superiore" },
      { v: "core", label: "Core / addome" },
      { v: "gambe", label: "Gambe e glutei" },
      { v: "mobilita", label: "Mobilità" },
      { v: "cardio", label: "Cardio" },
      { v: "tecnica", label: "Tecnica dei movimenti" },
    ],
  },
  {
    id: "altri_sport",
    testo: "Fai altro sport oltre a 100FT?",
    tipo: "multipla",
    opzioni: [
      { v: "corsa", label: "Corsa / running" },
      { v: "pesi", label: "Sala pesi" },
      { v: "squadra", label: "Sport di squadra" },
      { v: "yoga", label: "Yoga / pilates" },
      { v: "camminate", label: "Camminate / trekking" },
      { v: "nessuno", label: "No, solo 100FT" },
    ],
  },
];

// Le label selezionate, una riga per domanda risposta (per il riassunto sul profilo).
function riassuntoPersonalizzazione(answers) {
  return riassuntoRisposte(PERSONALIZZAZIONE_DOMANDE, answers).map((r) => r.risposta);
}

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

// PROFILI (tab Profilo della coach): elenco atleti navigabile. Toccando un atleta si apre
// la sua scheda completa — anagrafica privata, obiettivi dal questionario, feedback e
// sfide recenti, presenze, pagamento, reset password. La coach non si allena, quindi qui
// niente livello/scala/achievements suoi.
function renderProfiloCoach(content, p, onFotoCaricata) {
  let atletaAperto = null;

  function render() {
    if (atletaAperto == null) renderLista();
    else renderDettaglio(atletaAperto);
  }

  function renderLista() {
    content.innerHTML = `
      <div class="card" style="margin-bottom:12px">${fotoProfiloHtml(p?.fotoUrl, "C")}</div>
      <p class="mono" style="color:var(--mute); font-size:12px; letter-spacing:1px">PROFILI ATLETI</p>
      <div class="card" style="margin-top:10px" id="atleti-list"><p class="mono" style="color:var(--mute)">Carico...</p></div>
    `;
    attachFotoUpload(content, onFotoCaricata ?? (() => {}));

    const list = content.querySelector("#atleti-list");
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
            return `
              <button type="button" class="atleta-riga" data-user-id="${a.userId}"
                style="display:block; width:100%; text-align:left; background:none; border:none;
                       ${i === 0 ? "" : "border-top:1px solid var(--border);"} padding:12px 0;
                       color:inherit; font-family:inherit; cursor:pointer">
                <span style="display:flex; justify-content:space-between; align-items:baseline">
                  <span style="font-size:14px; font-weight:600">${esc(nome)}</span>
                  ${livelloHtml}
                </span>
                <span class="mono" style="color:var(--mute); font-size:12px; display:block; margin-top:4px">
                  ${a.presenzeUltime4Settimane} presenze (28gg) · ${feedbackHtml}
                </span>
              </button>
            `;
          })
          .join("");

        list.querySelectorAll(".atleta-riga").forEach((btn) => {
          btn.addEventListener("click", () => {
            atletaAperto = Number(btn.dataset.userId);
            render();
          });
        });
      })
      .catch((err) => {
        list.innerHTML = `<p class="error-text">${err instanceof ApiError ? err.message : "Errore imprevisto"}</p>`;
      });
  }

  function renderDettaglio(userId) {
    content.innerHTML = `
      <button type="button" class="link-btn" id="torna-lista">‹ Torna ai profili</button>
      <div id="scheda" style="margin-top:12px"><p class="mono" style="color:var(--mute)">Carico...</p></div>
    `;
    content.querySelector("#torna-lista").addEventListener("click", () => {
      atletaAperto = null;
      render();
    });

    const scheda = content.querySelector("#scheda");
    api
      .get(`/atleti/${userId}`)
      .then((d) => {
        scheda.innerHTML = schedaAtletaHtml(d);
        initSchedaAzioni(scheda, d, () => renderDettaglio(userId));
      })
      .catch((err) => {
        scheda.innerHTML = `<p class="error-text">${err instanceof ApiError ? err.message : "Errore imprevisto"}</p>`;
      });
  }

  render();
}

function schedaAtletaHtml(d) {
  const a = d.anagrafica;
  const dp = d.datiPrivati;
  const at = d.attivita;
  const nome = a.nickname || `${a.nome} ${a.cognome}`.trim();
  const nomeCompleto = `${a.nome} ${a.cognome}`.trim();
  const dn = formatDataNascita(a.dataNascita);

  const riga = (label, val) => `
    <div style="display:flex; justify-content:space-between; gap:10px; padding:7px 0; border-top:1px solid var(--border)">
      <span class="mono" style="color:var(--mute); font-size:13px">${label}</span>
      <span style="font-size:14px; text-align:right">${val ?? "—"}</span>
    </div>`;

  const obiettivi = riassuntoPersonalizzazione(dp.personalizzazione);

  const feedbackHtml = at.feedbackRecenti.length
    ? at.feedbackRecenti
        .map(
          (f) => `
            <div style="display:flex; align-items:baseline; gap:8px; padding:6px 0; border-top:1px solid var(--border)">
              <span style="font-size:18px">${FACCINA_EMOJI[f.faccina] ?? "•"}</span>
              <span class="mono" style="font-size:12px; color:var(--mute)">
                ${f.difficolta ? `${DIFFICOLTA_LABEL[f.difficolta] ?? f.difficolta} · ` : ""}${giorniFa(f.data)}
              </span>
              ${f.nota ? `<span style="font-size:12px">— ${esc(f.nota)}</span>` : ""}
            </div>`
        )
        .join("")
    : `<p class="mono" style="color:var(--mute); font-size:13px">Nessun feedback.</p>`;

  const sfideHtml = at.sfideFatte.length
    ? at.sfideFatte
        .map(
          (s) => `
            <div style="display:flex; justify-content:space-between; gap:10px; padding:6px 0; border-top:1px solid var(--border)">
              <span style="font-size:13px">${esc(s.titolo)}</span>
              <span class="mono" style="color:var(--mute); font-size:12px; white-space:nowrap">${giorniFa(s.data)}${s.punti ? ` · +${s.punti}` : ""}</span>
            </div>`
        )
        .join("")
    : `<p class="mono" style="color:var(--mute); font-size:13px">Nessuna sfida completata.</p>`;

  const richiesteHtml = at.richiesteRecenti.length
    ? at.richiesteRecenti
        .map(
          (r) =>
            `<p class="mono" style="color:var(--mute); font-size:12px; margin-top:2px">${esc(
              r.categoria ? etichettaCategoria(r.categoria) : r.testoLibero ?? ""
            )} · ${giorniFa(r.data)}</p>`
        )
        .join("")
    : `<p class="mono" style="color:var(--mute); font-size:13px">Nessuna richiesta recente.</p>`;

  const feedbackMensileHtml = (at.feedbackMensile ?? []).length
    ? at.feedbackMensile
        .map((fm) => {
          const righe = riassuntoRisposte(FEEDBACK_MENSILE_DOMANDE, fm.risposte);
          return `
            <div style="padding:8px 0; border-top:1px solid var(--border)">
              <p class="mono" style="font-size:12px; color:var(--mute)">${MESI[fm.mese - 1]?.toUpperCase()} ${fm.anno}</p>
              ${
                righe.length
                  ? righe
                      .map(
                        (r) =>
                          `<p style="font-size:13px; margin-top:4px">${esc(r.testo)}<br><span style="color:var(--accent)">${esc(r.risposta)}</span></p>`
                      )
                      .join("")
                  : `<p class="mono" style="font-size:12px; color:var(--mute); margin-top:4px">Nessuna risposta.</p>`
              }
            </div>`;
        })
        .join("")
    : `<p class="mono" style="color:var(--mute); font-size:13px">Nessun feedback mensile.</p>`;

  const livelloBadge = at.livello
    ? `<span class="mono" style="color:${at.livello.attuale.colore}; font-size:12px">Livello ${at.livello.attuale.numero} — ${at.livello.attuale.nome}</span>`
    : `<span class="mono" style="color:var(--mute); font-size:12px">Nessun livello</span>`;

  const avatar = a.fotoUrl
    ? `<img src="${mediaUrl(a.fotoUrl)}" alt="" style="width:54px; height:54px; border-radius:50%; object-fit:cover; flex-shrink:0" />`
    : `<span style="width:54px; height:54px; border-radius:50%; background:var(--surface-2); display:flex; align-items:center; justify-content:center; font-size:20px; color:var(--mute); flex-shrink:0">${(nome[0] ?? "?").toUpperCase()}</span>`;

  return `
    <div class="card">
      <div style="display:flex; align-items:center; gap:12px">
        ${avatar}
        <div style="min-width:0">
          <p style="font-weight:700; font-size:17px">${esc(nome)}</p>
          ${nomeCompleto && nomeCompleto !== nome ? `<p class="mono" style="color:var(--mute); font-size:12px">${esc(nomeCompleto)}</p>` : ""}
          <p style="margin-top:2px">${livelloBadge}</p>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:12px">
      <p class="mono" style="color:var(--mute); font-size:12px">ANAGRAFICA</p>
      <div style="margin-top:6px">
        ${riga("Data di nascita", dn ? `${dn}${a.eta != null ? ` · ${a.eta} anni` : ""}` : null)}
        ${riga("Peso", dp.peso != null ? `${dp.peso} kg` : null)}
        ${riga("Altezza", dp.altezza != null ? `${dp.altezza} cm` : null)}
        ${riga("Note / infortuni", dp.noteInfortuni ? esc(dp.noteInfortuni) : null)}
      </div>
    </div>

    <div class="card" style="margin-top:12px">
      <p class="mono" style="color:var(--mute); font-size:12px">OBIETTIVI</p>
      ${
        obiettivi.length
          ? `<div style="margin-top:6px; display:flex; flex-direction:column; gap:4px">${obiettivi
              .map((o) => `<p style="font-size:14px">${esc(o)}</p>`)
              .join("")}</div>`
          : `<p class="mono" style="color:var(--mute); font-size:13px; margin-top:6px">Non ha ancora personalizzato il profilo.</p>`
      }
    </div>

    <div class="card" style="margin-top:12px">
      <p class="mono" style="color:var(--mute); font-size:12px">ATTIVITÀ</p>
      <p class="mono" style="color:var(--mute); font-size:12px; margin-top:6px">${at.presenzeTotali} presenze totali · ${at.presenzeUltime4Settimane} negli ultimi 28 giorni</p>
      <p class="mono" style="color:var(--mute); font-size:11px; letter-spacing:1px; margin-top:12px">FEEDBACK RECENTI</p>
      <div style="margin-top:4px">${feedbackHtml}</div>
    </div>

    <div class="card" style="margin-top:12px">
      <p class="mono" style="color:var(--mute); font-size:12px">SFIDE FATTE</p>
      <div style="margin-top:6px">${sfideHtml}</div>
    </div>

    <div class="card" style="margin-top:12px">
      <p class="mono" style="color:var(--mute); font-size:12px">RICHIESTE RECENTI</p>
      <div style="margin-top:6px">${richiesteHtml}</div>
    </div>

    <div class="card" style="margin-top:12px">
      <p class="mono" style="color:var(--mute); font-size:12px">FEEDBACK MENSILE</p>
      <div style="margin-top:2px">${feedbackMensileHtml}</div>
    </div>

    <div class="card" style="margin-top:12px">
      <p class="mono" style="color:var(--mute); font-size:12px">TROFEI</p>
      <div style="margin-top:10px">${trofeiRigaHtml(at.trofei)}</div>
    </div>

    <div class="card" style="margin-top:12px">
      <p class="mono" style="color:var(--mute); font-size:12px">GESTIONE</p>
      <div style="margin-top:10px; display:flex; gap:14px; align-items:center; flex-wrap:wrap">
        ${pagamentoBadgeHtml(d.userId, at.pagamentoMese)}
        <button type="button" class="link-btn reset-password-btn" data-user-id="${d.userId}" data-nome="${esc(nome).replace(/"/g, "&quot;")}"
          style="text-decoration:none; color:var(--mute); font-family:var(--font-mono); font-size:11px; letter-spacing:1px">
          RESET PASSWORD
        </button>
      </div>
      <div class="reset-password-esito" data-user-id="${d.userId}" style="margin-top:6px"></div>
    </div>
  `;
}

function initSchedaAzioni(scheda, d, ricarica) {
  scheda.querySelectorAll(".pagamento-toggle").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const nuovoStato = btn.dataset.stato === "pagato" ? "non_pagato" : "pagato";
      btn.disabled = true;
      try {
        await api.post("/pagamenti", { userId: Number(btn.dataset.userId), stato: nuovoStato });
        ricarica();
      } catch {
        btn.disabled = false;
      }
    });
  });

  scheda.querySelectorAll(".reset-password-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const userId = Number(btn.dataset.userId);
      if (!confirm(`Reimpostare la password di ${btn.dataset.nome}? Verrà disconnesso da tutti i dispositivi.`)) return;
      const esito = scheda.querySelector(`.reset-password-esito[data-user-id="${userId}"]`);
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
}

// ─── Card "I TUOI DATI" (anagrafica privata: data nascita, peso, altezza, note) ───
function datiPersonaliCardHtml(p) {
  const dn = formatDataNascita(p.dataNascita);
  const eta = calcolaEta(p.dataNascita);
  const dp = p.datiPrivati ?? {};
  const riga = (label, val) => `
    <div style="display:flex; justify-content:space-between; gap:10px; padding:7px 0; border-top:1px solid var(--border)">
      <span class="mono" style="color:var(--mute); font-size:13px">${label}</span>
      <span style="font-size:14px; text-align:right">${val ?? "—"}</span>
    </div>`;
  const inputStyle =
    "width:100%; background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:10px 12px; color:var(--text); font-family:inherit; font-size:14px";
  return `
    <div class="card" style="margin-top:12px" id="dati-card">
      <div style="display:flex; justify-content:space-between; align-items:baseline">
        <p class="mono" style="color:var(--mute); font-size:12px">I TUOI DATI</p>
        <button type="button" class="link-btn" id="dati-modifica">Modifica</button>
      </div>
      <div id="dati-vista" style="margin-top:6px">
        ${riga("Data di nascita", dn ? `${dn}${eta != null ? ` · ${eta} anni` : ""}` : null)}
        ${riga("Peso", dp.peso != null ? `${dp.peso} kg` : null)}
        ${riga("Altezza", dp.altezza != null ? `${dp.altezza} cm` : null)}
        ${riga("Note / infortuni", dp.noteInfortuni ? esc(dp.noteInfortuni) : null)}
        <p class="mono" style="color:var(--mute); font-size:11px; margin-top:10px">Visibili solo a te e alla coach</p>
      </div>
      <form id="dati-form" hidden style="margin-top:12px">
        <div class="field">
          <label for="dati-data">Data di nascita</label>
          <input id="dati-data" type="date" value="${p.dataNascita ?? ""}" />
        </div>
        <div style="display:flex; gap:10px">
          <div class="field" style="flex:1">
            <label for="dati-peso">Peso (kg)</label>
            <input id="dati-peso" type="number" step="0.1" min="20" max="300" inputmode="decimal" value="${dp.peso ?? ""}" />
          </div>
          <div class="field" style="flex:1">
            <label for="dati-altezza">Altezza (cm)</label>
            <input id="dati-altezza" type="number" step="1" min="100" max="250" inputmode="numeric" value="${dp.altezza ?? ""}" />
          </div>
        </div>
        <div class="field">
          <label for="dati-note">Note / infortuni (per la coach)</label>
          <textarea id="dati-note" rows="3" maxlength="1000" style="${inputStyle}; resize:vertical">${dp.noteInfortuni ? esc(dp.noteInfortuni) : ""}</textarea>
        </div>
        <p class="error-text" id="dati-error" hidden></p>
        <div style="display:flex; gap:8px">
          <button class="btn" type="submit" style="flex:1">Salva</button>
          <button type="button" class="btn" id="dati-annulla" style="flex:1; background:var(--surface-2); color:var(--text)">Annulla</button>
        </div>
      </form>
    </div>`;
}

function initDatiPersonali(content, onSaved) {
  const card = content.querySelector("#dati-card");
  if (!card) return;
  const vista = card.querySelector("#dati-vista");
  const form = card.querySelector("#dati-form");
  const modifica = card.querySelector("#dati-modifica");
  const errorEl = card.querySelector("#dati-error");

  const apri = (mostra) => {
    form.hidden = !mostra;
    vista.hidden = mostra;
    modifica.hidden = mostra;
  };
  modifica.addEventListener("click", () => apri(true));
  card.querySelector("#dati-annulla").addEventListener("click", () => apri(false));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    const pesoRaw = card.querySelector("#dati-peso").value.trim();
    const altezzaRaw = card.querySelector("#dati-altezza").value.trim();
    const payload = {
      dataNascita: card.querySelector("#dati-data").value || null,
      peso: pesoRaw === "" ? null : Number(pesoRaw),
      altezza: altezzaRaw === "" ? null : Number(altezzaRaw),
      noteInfortuni: card.querySelector("#dati-note").value.trim() || null,
    };
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      await api.post("/profilo/me", payload);
      onSaved();
    } catch (err) {
      errorEl.textContent = err instanceof ApiError ? err.message : "Errore imprevisto";
      errorEl.hidden = false;
      btn.disabled = false;
    }
  });
}

// ─── Card "PERSONALIZZA IL TUO PROFILO" (questionario a risposta guidata) ───
function personalizzaCardHtml(p) {
  const answers = p.datiPrivati?.personalizzazione ?? {};
  const riassunto = riassuntoPersonalizzazione(answers);
  const compilata = riassunto.length > 0;
  return `
    <div class="card" style="margin-top:12px" id="personalizza-card">
      <p class="mono" style="color:var(--mute); font-size:12px">PERSONALIZZA IL TUO PROFILO</p>
      <div id="personalizza-vista" style="margin-top:8px">
        ${
          compilata
            ? `<p style="font-size:14px">${riassunto.map(esc).join(" · ")}</p>
               <button type="button" class="link-btn" id="personalizza-apri" style="margin-top:8px">Rivedi le risposte</button>`
            : `<p class="mono" style="color:var(--mute); font-size:13px">Rispondi a qualche domanda veloce: la coach potrà tarare meglio il lavoro su di te.</p>
               <button class="btn" type="button" id="personalizza-apri" style="width:100%; margin-top:10px">Inizia</button>`
        }
      </div>
      <form id="personalizza-form" hidden style="margin-top:12px"></form>
    </div>`;
}

function initPersonalizza(content, p, onSaved) {
  const card = content.querySelector("#personalizza-card");
  if (!card) return;
  const vista = card.querySelector("#personalizza-vista");
  const form = card.querySelector("#personalizza-form");
  let q = null;

  card.querySelector("#personalizza-apri").addEventListener("click", () => {
    form.innerHTML = `
      <div id="pz-domande"></div>
      <p class="error-text" id="pz-error" hidden></p>
      <div style="display:flex; gap:8px">
        <button class="btn" type="submit" style="flex:1">Salva</button>
        <button type="button" class="btn" id="pz-annulla" style="flex:1; background:var(--surface-2); color:var(--text)">Annulla</button>
      </div>`;
    q = costruisciQuestionario(form.querySelector("#pz-domande"), PERSONALIZZAZIONE_DOMANDE, p.datiPrivati?.personalizzazione ?? {});
    form.hidden = false;
    vista.hidden = true;

    form.querySelector("#pz-annulla").addEventListener("click", () => {
      form.hidden = true;
      form.innerHTML = "";
      vista.hidden = false;
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = form.querySelector("#pz-error");
    if (errorEl) errorEl.hidden = true;
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      await api.post("/profilo/me", { personalizzazione: q ? q.getRisposte() : {} });
      onSaved();
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err instanceof ApiError ? err.message : "Errore imprevisto";
        errorEl.hidden = false;
      }
      btn.disabled = false;
    }
  });
}

async function loadProfilo(el) {
  const content = el.querySelector("#profilo-content");
  try {
    const p = await api.get("/profilo/me");

    if (p.role === "coach") {
      const h1 = el.querySelector("h1");
      if (h1) h1.textContent = "Profili";
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
    const datiCard = datiPersonaliCardHtml(p);
    const personalizzaCard = personalizzaCardHtml(p);
    const trofeiCard = `
      <div class="card" style="margin-top:12px">
        <p class="mono" style="color:var(--mute); font-size:12px">I TUOI TROFEI</p>
        <div style="margin-top:10px">${trofeiRigaHtml(p.trofei)}</div>
      </div>`;

    // Sotto la foto: nickname grande, poi Nome Cognome più piccolo. Senza nickname,
    // il nome completo sta sulla riga grande e non c'è la seconda riga.
    const nomeCompleto = `${p.nome ?? ""} ${p.cognome ?? ""}`.trim();
    const nomeCard = `
      <p style="font-weight:700; font-size:20px; margin-top:10px; text-align:center">${esc(p.nickname || nomeCompleto || "Atleta")}</p>
      ${
        p.nickname && nomeCompleto
          ? `<p class="mono" style="color:var(--mute); font-size:13px; margin-top:2px; text-align:center">${esc(nomeCompleto)}</p>`
          : ""
      }
    `;

    if (!p.livello) {
      content.innerHTML = `
        <div class="card">
          ${fotoHtml}
          ${nomeCard}
          <p class="mono" style="color:var(--mute); margin-top:8px">
            Nessun livello ancora — completa la tua prima settimana (Training + Challenges + Feedback) per sbloccarlo.
          </p>
        </div>
        ${datiCard}
        ${personalizzaCard}
        ${trofeiCard}
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
          ${nomeCard}
          <p class="mono" style="color:${attuale.colore}; font-size:13px; margin-top:4px; text-align:center">Livello ${attuale.numero} — ${attuale.nome}</p>
        </div>
        <div class="card" style="margin-top:12px; text-align:center">
          <img src="/cards/card_final_${attuale.numero}.png" alt="Livello ${attuale.numero}"
               style="width:120px; height:120px; border-radius:12px; object-fit:cover" />
          <p class="mono" style="color:var(--mute); font-size:12px; margin-top:10px">Scala livelli</p>
          <div style="margin-top:8px">${scalaLivelliHtml(p.livello)}</div>
        </div>
        ${datiCard}
        ${personalizzaCard}
        ${trofeiCard}
        ${statsHtml}
        ${achievementsCard}
        ${notificheCard}
        ${sicurezzaCard}
      `;
    }

    attachFotoUpload(content, () => loadProfilo(el));

    initDatiPersonali(content, () => loadProfilo(el));
    initPersonalizza(content, p, () => loadProfilo(el));
    initNotifiche(content);
    initSicurezza(content);
  } catch (err) {
    content.innerHTML = `<p class="error-text">${err instanceof ApiError ? err.message : "Errore imprevisto"}</p>`;
  }
}
