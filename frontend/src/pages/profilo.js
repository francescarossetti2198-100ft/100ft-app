import { renderTabbar } from "../components/tabbar.js";
import { logout } from "../auth.js";
import { navigate } from "../router.js";
import { api, ApiError, mediaUrl } from "../api.js";
import { statoNotifiche, attivaNotifiche, disattivaNotifiche } from "../push.js";
import { costruisciQuestionario, riassuntoRisposte, elencoRisposte } from "../components/questionario.js";
import { FEEDBACK_MENSILE_DOMANDE } from "../feedback-mensile-domande.js";
import { etichettaCategoria } from "../richieste-categorie.js";
import { trofeiRigaHtml } from "../trofei.js";

// Palette fissa di brand per l'accento delle card del Profilo (i 6 colori livello + il
// viola accent). Deve restare allineata a COLORI_CARD in worker/src/routes/profilo.ts.
const COLORI_CARD = ["#8b5cf6", "#8bc53f", "#2d7dd2", "#f4b740", "#ff7a29", "#e63946", "#a85cff"];

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
// "Obiettivi personali" — questionario a risposta guidata (mai testo libero).
//
// Per cambiare le domande basta riscrivere QUESTO array — salvataggio, riassunto e
// rendering non cambiano. Ogni voce: { id, testo, tipo: "singola" | "multipla", max?,
// opzioni: [{ v, label, emoji, esclusiva? }] }. L'emoji è il puntino d'elenco con cui la
// risposta compare nella card. `esclusiva: true` = opzione che azzera le altre.
// Risposte salvate: { [id]: "v" }  (singola)  |  { [id]: ["v1","v2"] }  (multipla).
// ────────────────────────────────────────────────────────────────────────────
const PERSONALIZZAZIONE_DOMANDE = [
  {
    id: "obiettivi",
    testo: "Quali sono i tuoi obiettivi?",
    tipo: "multipla",
    opzioni: [
      { v: "forza", label: "Diventare più forte", emoji: "💪" },
      { v: "tonificare", label: "Tonificare il corpo", emoji: "🔥" },
      { v: "resistenza", label: "Migliorare la resistenza", emoji: "🏃" },
      { v: "mobilita", label: "Migliorare mobilità e movimento", emoji: "🧘" },
      { v: "forma", label: "Sentirmi più in forma", emoji: "⚡" },
      { v: "peso", label: "Perdere peso", emoji: "⚖️" },
    ],
  },
  {
    id: "migliorare",
    testo: "Cosa vuoi migliorare?",
    tipo: "multipla",
    opzioni: [
      { v: "forza", label: "Forza", emoji: "🏋️" },
      { v: "resistenza", label: "Resistenza", emoji: "🫁" },
      { v: "mobilita", label: "Mobilità", emoji: "🤸" },
      { v: "equilibrio", label: "Equilibrio", emoji: "⚖️" },
      { v: "coordinazione", label: "Coordinazione", emoji: "🎯" },
      { v: "core", label: "Core", emoji: "🔩" },
      { v: "gambe", label: "Gambe e glutei", emoji: "🦵" },
      { v: "upper", label: "Parte superiore del corpo", emoji: "💪" },
    ],
  },
  {
    id: "motivazione",
    testo: "Cosa ti motiva a iniziare questo percorso?",
    tipo: "multipla",
    opzioni: [
      { v: "meglio", label: "Sentirmi meglio", emoji: "😊" },
      { v: "cambiamenti", label: "Vedere dei cambiamenti", emoji: "🔎" },
      { v: "energia", label: "Avere più energia", emoji: "⚡" },
      { v: "forte", label: "Diventare più forte", emoji: "🏋️" },
      { v: "forma", label: "Migliorare la forma fisica", emoji: "✨" },
      { v: "cura", label: "Prendermi più cura di me", emoji: "💗" },
      { v: "abitudine", label: "Creare una buona abitudine", emoji: "🔁" },
    ],
  },
  {
    id: "altri_sport",
    testo: "Fai altro sport oltre a 100FT?",
    tipo: "multipla",
    opzioni: [
      { v: "corsa", label: "Corsa / running", emoji: "🏃" },
      { v: "yoga", label: "Yoga / pilates", emoji: "🧘" },
      { v: "squadra", label: "Sport di squadra", emoji: "⚽" },
      { v: "camminate", label: "Camminata / trekking", emoji: "🥾" },
      { v: "ciclismo", label: "Ciclismo", emoji: "🚴" },
      { v: "individuali", label: "Sport individuali (tennis, padel, ecc.)", emoji: "🎾" },
      { v: "altro", label: "Altro", emoji: "➕" },
      { v: "nessuno", label: "No, solo 100FT", emoji: "💯", esclusiva: true },
    ],
  },
];

// Gli obiettivi selezionati come elenco { emoji, label } — una riga per opzione scelta
// (card "Obiettivi personali" sul profilo e sezione OBIETTIVI della scheda coach).
function obiettiviElenco(answers) {
  return elencoRisposte(PERSONALIZZAZIONE_DOMANDE, answers);
}

// TODO: dati pubblici vs privati, stato pagamento (brief, sezione 14) — servono la Coach
// Dashboard e una decisione su come gestire i dati privati dell'atleta.
export function renderProfilo(appEl) {
  const el = document.createElement("div");
  el.className = "screen";
  el.innerHTML = `
    <style>
      /* Colore scelto dall'atleta (--accent su #profilo-content): tinge in modo tenue
         lo sfondo e il bordo di tutte le schede del profilo. */
      #profilo-content.ha-colore .card {
        background-color: color-mix(in srgb, var(--accent) 8%, var(--surface));
        border-color: color-mix(in srgb, var(--accent) 22%, var(--border));
      }
      /* Lineetta accento sotto il titolo della scheda "I tuoi dati" (il <summary> a
         tendina non ha la barretta di .sezione-label). */
      #profilo-content #dati-card > .blocco-mese > summary { position: relative; padding-bottom: 18px; }
      #profilo-content #dati-card > .blocco-mese > summary::before {
        content: ""; position: absolute; left: 0; bottom: 7px;
        width: 26px; height: 3px; border-radius: 2px; background: var(--accent);
      }
      /* Luce stato abbonamento (card identità): rossa = non attivo, verde = attivo,
         entrambe lampeggiano. */
      #profilo-content .abbonamento-luce {
        background: #ef4444; box-shadow: 0 0 7px #ef4444;
        animation: abb-pulse 1.3s ease-in-out infinite;
      }
      #profilo-content .abbonamento-luce.attivo {
        background: #22c55e; box-shadow: 0 0 7px #22c55e;
      }
      @keyframes abb-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
      @media (prefers-reduced-motion: reduce) {
        #profilo-content .abbonamento-luce { animation: none; }
      }
    </style>
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
      ${pagato ? "ABBONAMENTO ATTIVO ✓" : "ABBONAMENTO NON ATTIVO"}
    </button>
  `;
}

// Blocco foto profilo — usato sia dall'atleta sia dalla coach (il backend accetta la foto
// per entrambi, e compare in classifica accanto al nome). L'input è nascosto visivamente
// invece che con l'attributo `hidden`: su iOS Safari un file input con `hidden` a volte non
// apre il selettore quando viene attivato dalla label.
function fotoProfiloHtml(fotoUrl, iniziale, modifica = true) {
  const media = fotoUrl
    ? `<img src="${mediaUrl(fotoUrl)}" alt="Foto profilo" style="width:84px; height:84px; border-radius:50%; object-fit:cover; border:2px solid var(--border)" />`
    : `<span style="width:84px; height:84px; border-radius:50%; background:var(--surface-2); display:flex; align-items:center; justify-content:center; font-size:28px; color:var(--mute)">${iniziale}</span>`;

  // Fuori dalla modalità modifica: solo la foto, niente "Cambia foto" / input.
  if (!modifica) return `<div style="text-align:center">${media}</div>`;

  return `
    <div style="text-align:center">
      <label for="foto-input" style="cursor:pointer; display:inline-block">
        ${media}
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

  const obiettivi = obiettiviElenco(dp.personalizzazione);

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
          ? `<ul style="list-style:none; padding:0; margin:6px 0 0; display:flex; flex-direction:column; gap:5px">${obiettivi
              .map((o) => `<li style="font-size:14px">${o.emoji} ${esc(o.label)}</li>`)
              .join("")}</ul>`
          : `<p class="mono" style="color:var(--mute); font-size:13px; margin-top:6px">Non ha ancora indicato i suoi obiettivi.</p>`
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
      <p class="mono" style="color:var(--mute); font-size:12px">BADGE</p>
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

// ─── Card "IMPOSTAZIONI" (in fondo al profilo): Notifiche push, Sicurezza,
// Regolamento — ognuna a tendina — più il pulsante Esci. ───────────────────────

// I 6 livelli con nome, colore e numero di allenamenti necessari per raggiungerli.
// Tenere allineato a worker/src/lib/livelli.ts (LIVELLI).
const LIVELLI_REGOLAMENTO = [
  { numero: 1, nome: "Facile", colore: "#8BC53F", allenamentiMin: 3 },
  { numero: 2, nome: "Inizio", colore: "#2D7DD2", allenamentiMin: 18 },
  { numero: 3, nome: "Intermedio", colore: "#F4B740", allenamentiMin: 36 },
  { numero: 4, nome: "Avanzato", colore: "#FF7A29", allenamentiMin: 60 },
  { numero: 5, nome: "Esperto", colore: "#E63946", allenamentiMin: 75 },
  { numero: 6, nome: "Leggendario", colore: "#A85CFF", allenamentiMin: 90 },
];

function livelliRegolamentoHtml() {
  // La card del livello 1 si vede, quelle da 2 a 6 restano sfocate: la grafica è
  // una sorpresa che si svela salendo di livello.
  return `
    <div style="display:flex; gap:10px; overflow-x:auto; padding:10px 0 4px; margin-top:4px">
      ${LIVELLI_REGOLAMENTO.map(
        (l) => `
        <div style="flex:0 0 auto; width:92px; text-align:center">
          <img src="/cards/card_final_${l.numero}.png" alt="Livello ${l.numero} — ${l.nome}"
               style="width:92px; height:92px; object-fit:contain${l.numero >= 2 ? "; filter:blur(6px)" : ""}" />
          <p style="font-weight:700; font-size:12px; margin-top:4px; color:${l.colore}">${l.numero}. ${l.nome}</p>
          <p class="mono" style="color:var(--mute); font-size:11px; margin-top:1px">da ${l.allenamentiMin} allenamenti</p>
        </div>`
      ).join("")}
    </div>`;
}

// Come funziona l'app, in breve. Bozza: Francesca può ritoccare i testi.
// Ogni voce: { titolo, corpo, extra? } — `extra` è HTML già pronto, appeso sotto al corpo.
const REGOLAMENTO = [
  {
    titolo: "Banner presenze",
    corpo:
      "In Home segni la tua presenza il giorno dell'allenamento. È il gesto da cui parte tutto: senza presenza la settimana non si chiude.",
  },
  {
    titolo: "Anelli di riepilogo",
    corpo:
      "Ogni settimana ha tre anelli: Allenamento (presenza), Sfide e Feedback. Quando li chiudi tutti e tre, la settimana è completata e conta per il livello.",
  },
  {
    titolo: "Classifica",
    corpo:
      "Nella pagina Sfide c'è la classifica per settimana, mese e totale. I punti arrivano dalle attività che fai (vedi «Sistema di punteggio»). La freccia indica se sei salito o sceso rispetto al periodo prima.",
  },
  {
    titolo: "Sistema di punteggio",
    corpo:
      "I punti alimentano la classifica (settimana, mese, totale). Quanto vale ogni attività:",
    extra: `
      <ul style="list-style:none; padding:0; margin:8px 0 0; display:flex; flex-direction:column; gap:6px">
        <li class="mono" style="font-size:13px">🏋️ Presenza confermata a un allenamento — <strong>+10 punti</strong></li>
        <li class="mono" style="font-size:13px">💧 Daily Drop (la foto del momento) — <strong>+10 punti</strong></li>
        <li class="mono" style="font-size:13px">🎯 Sfida completata — <strong>i punti che la coach ha assegnato a quella sfida</strong></li>
        <li class="mono" style="font-size:13px">🗒️ Questionario del mese — <strong>+15 punti</strong></li>
      </ul>
      <p class="mono" style="color:var(--mute); font-size:12px; margin-top:8px; line-height:1.5">Sezione in lavorazione: i valori verranno rivisti insieme alla coach.</p>`,
  },
  {
    titolo: "Livelli",
    corpo:
      "Ci sono 6 livelli. Si sale accumulando settimane completate — non serve farle di fila, contano quante in totale (una settimana completata = tutti e 3 gli anelli chiusi). La card del livello e la scala sono nel Profilo.",
    extra: livelliRegolamentoHtml(),
  },
  {
    titolo: "Badge",
    corpo:
      "I badge di stagione (autunno e primavera) si sbloccano completando le sfide del periodo. Li trovi nella card «I tuoi badge».",
  },
  {
    titolo: "Programma",
    corpo:
      "Ogni mese la coach pubblica il programma: focus del mese, obiettivo, perché, risultato atteso, sane abitudini e le merende fit. I mesi futuri restano bloccati finché non è il loro turno.",
  },
  {
    titolo: "Feed",
    corpo:
      "Il diario del gruppo: livelli raggiunti, sfide, Daily Drop, annunci della coach. Puoi reagire ai post con le emoji, niente commenti.",
  },
  {
    titolo: "Obiettivi personali",
    corpo:
      "Rispondi a qualche domanda guidata sui tuoi obiettivi: la coach li vede e tara il lavoro su di te. Puoi rivederli quando vuoi dalla card «Obiettivi personali».",
  },
];

function regolamentoHtml() {
  return REGOLAMENTO.map(
    (r) => `
      <div style="padding:8px 0; border-top:1px solid var(--border)">
        <p style="font-weight:700; font-size:13px">${r.titolo}</p>
        <p class="mono" style="color:var(--mute); font-size:13px; margin-top:3px; line-height:1.5">${r.corpo}</p>
        ${r.extra ?? ""}
      </div>`
  ).join("");
}

function impostazioniCardHtml() {
  return `
    <div class="card" style="margin-top:12px" id="impostazioni-card">
      <p class="sezione-label">Impostazioni</p>
      <div style="margin-top:10px">
        <details class="blocco-mese" id="notifiche-card">
          <summary>Notifiche push</summary>
          <div class="blocco-corpo">
            <div id="notifiche-stato"><p class="mono" style="color:var(--mute); font-size:13px">Verifico...</p></div>
          </div>
        </details>
        <details class="blocco-mese" id="sicurezza-card">
          <summary>Sicurezza</summary>
          <div class="blocco-corpo">
            <form id="cambio-password-form">
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
        </details>
        <details class="blocco-mese">
          <summary>Regolamento</summary>
          <div class="blocco-corpo">${regolamentoHtml()}</div>
        </details>
      </div>
      <button class="btn" id="impostazioni-logout" style="width:100%; margin-top:14px; background:var(--surface-2); color:var(--text)">Esci</button>
    </div>
  `;
}

function initSicurezza(content) {
  const card = content.querySelector("#sicurezza-card");
  if (!card) return;
  const form = card.querySelector("#cambio-password-form");
  const errorEl = card.querySelector("#pw-error");
  const successEl = card.querySelector("#pw-success");

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
      <details class="blocco-mese" id="dati-details">
        <summary>I tuoi dati</summary>
        <div class="blocco-corpo">
          <div id="dati-vista">
            ${riga("Data di nascita", dn ? `${dn}${eta != null ? ` · ${eta} anni` : ""}` : null)}
            ${riga("Peso", dp.peso != null ? `${dp.peso} kg` : null)}
            ${riga("Altezza", dp.altezza != null ? `${dp.altezza} cm` : null)}
            ${riga("Note / infortuni", dp.noteInfortuni ? esc(dp.noteInfortuni) : null)}
            <p class="mono" style="color:var(--mute); font-size:11px; margin-top:10px">Visibili solo a te e alla coach</p>
            <button type="button" class="link-btn" id="dati-modifica" style="margin-top:8px">Modifica</button>
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
        </div>
      </details>
    </div>`;
}

function initDatiPersonali(content, onSaved) {
  const card = content.querySelector("#dati-card");
  if (!card) return;
  const dettaglio = card.querySelector("#dati-details");
  const vista = card.querySelector("#dati-vista");
  const form = card.querySelector("#dati-form");
  const modifica = card.querySelector("#dati-modifica");
  const errorEl = card.querySelector("#dati-error");

  const apri = (mostra) => {
    if (mostra) dettaglio.open = true;
    form.hidden = !mostra;
    vista.hidden = mostra;
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

// ─── Card "OBIETTIVI PERSONALI" (questionario a risposta guidata, mostrato come
// elenco puntato con emoji) ───
function obiettiviCardHtml(p) {
  const answers = p.datiPrivati?.personalizzazione ?? {};
  const elenco = obiettiviElenco(answers);
  const compilata = elenco.length > 0;
  return `
    <div class="card" style="margin-top:12px" id="personalizza-card">
      <p class="sezione-label">Obiettivi personali</p>
      <div id="personalizza-vista" style="margin-top:8px">
        ${
          compilata
            ? `<ul style="list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:6px">${elenco
                 .map((o) => `<li style="font-size:14px">${o.emoji} ${esc(o.label)}</li>`)
                 .join("")}</ul>
               <button type="button" class="link-btn" id="personalizza-apri" style="margin-top:10px">Modifica gli obiettivi</button>`
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

// ─── Prima card: identità (foto + nome + livello). Matita in alto a destra →
// modalità modifica di foto, nickname, nome, cognome e colore delle card. ───
function identitaCardHtml(p) {
  const nomeCompleto = `${p.nome ?? ""} ${p.cognome ?? ""}`.trim();
  const iniziale = (p.nickname || p.nome || "Atleta")[0]?.toUpperCase() ?? "?";

  const livelloLinea = p.livello
    ? `<p class="mono" style="color:${p.livello.attuale.colore}; font-size:13px; margin-top:4px; text-align:center">Livello ${p.livello.attuale.numero} — ${p.livello.attuale.nome}</p>`
    : `<p class="mono" style="color:var(--mute); font-size:12px; margin-top:8px; text-align:center">Nessun livello ancora — fai i tuoi primi 3 allenamenti per sbloccarlo.</p>`;

  const pastiglia = (hex, label, contenuto = "") => `
    <button type="button" class="col-opt" data-colore="${hex}" aria-label="${label}"
      style="width:28px; height:28px; border-radius:50%; background:${hex || "var(--surface-2)"};
             display:flex; align-items:center; justify-content:center; font-size:12px; color:var(--mute);
             cursor:pointer; border:2px solid ${(p.cardColore ?? "") === hex ? "var(--text)" : "transparent"}">${contenuto}</button>`;

  const abbAttivo = !!p.abbonamentoAttivo;

  return `
    <div class="card" id="identita-card" style="position:relative">
      <button type="button" class="abbonamento-luce${abbAttivo ? " attivo" : ""}" aria-label="Stato abbonamento"
        style="position:absolute; top:16px; left:16px; width:13px; height:13px; border-radius:50%; border:none; padding:0; cursor:pointer"></button>
      <span class="abbonamento-banner" hidden
        style="position:absolute; top:36px; left:14px; z-index:3; font-size:11px; font-weight:700; letter-spacing:0.5px;
               padding:4px 9px; border-radius:6px; white-space:nowrap; background:var(--surface-2); color:var(--text); border:1px solid var(--border)">
        ${abbAttivo ? "Abbonamento attivo" : "Abbonamento non attivo"}
      </span>
      <button type="button" class="link-btn" id="identita-modifica" aria-label="Modifica profilo"
        style="position:absolute; top:12px; right:12px; text-decoration:none; font-size:16px">✏️</button>

      <div id="identita-vista">
        ${fotoProfiloHtml(p.fotoUrl, iniziale, false)}
        <p style="font-weight:700; font-size:20px; margin-top:10px; text-align:center">${esc(p.nickname || nomeCompleto || "Atleta")}</p>
        ${
          p.nickname && nomeCompleto
            ? `<p class="mono" style="color:var(--mute); font-size:13px; margin-top:2px; text-align:center">${esc(nomeCompleto)}</p>`
            : ""
        }
        ${livelloLinea}
      </div>

      <form id="identita-form" hidden style="margin-top:6px">
        ${fotoProfiloHtml(p.fotoUrl, iniziale, true)}
        <div class="field" style="margin-top:12px">
          <label for="id-nickname">Nickname</label>
          <input id="id-nickname" type="text" maxlength="40" value="${esc(p.nickname ?? "")}" />
        </div>
        <div style="display:flex; gap:10px">
          <div class="field" style="flex:1">
            <label for="id-nome">Nome</label>
            <input id="id-nome" type="text" maxlength="60" value="${esc(p.nome ?? "")}" />
          </div>
          <div class="field" style="flex:1">
            <label for="id-cognome">Cognome</label>
            <input id="id-cognome" type="text" maxlength="60" value="${esc(p.cognome ?? "")}" />
          </div>
        </div>
        <p style="font-size:13px; color:var(--mute); margin:0 0 6px">Colore delle card</p>
        <div id="id-colori" style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:14px">
          ${COLORI_CARD.map((hex) => pastiglia(hex, hex)).join("")}
          ${pastiglia("", "Predefinito", "✕")}
        </div>
        <p class="error-text" id="identita-error" hidden></p>
        <div style="display:flex; gap:8px">
          <button class="btn" type="submit" style="flex:1">Salva</button>
          <button type="button" class="btn" id="identita-annulla" style="flex:1; background:var(--surface-2); color:var(--text)">Annulla</button>
        </div>
      </form>
    </div>
  `;
}

function initIdentita(content, p, onSaved) {
  const card = content.querySelector("#identita-card");
  if (!card) return;
  const vista = card.querySelector("#identita-vista");
  const form = card.querySelector("#identita-form");
  const modifica = card.querySelector("#identita-modifica");
  const errorEl = card.querySelector("#identita-error");
  let coloreScelto = p.cardColore ?? "";

  const apri = (mostra) => {
    form.hidden = !mostra;
    vista.hidden = mostra;
    modifica.hidden = mostra;
    // annullando, ripristina l'anteprima colore allo stato salvato
    if (!mostra) {
      coloreScelto = p.cardColore ?? "";
      applicaColore(coloreScelto);
    }
  };
  const applicaColore = (hex) => {
    if (hex) content.style.setProperty("--accent", hex);
    else content.style.removeProperty("--accent");
    content.classList.toggle("ha-colore", !!hex);
    card.querySelectorAll(".col-opt").forEach((x) => {
      x.style.borderColor = x.dataset.colore === hex ? "var(--text)" : "transparent";
    });
  };

  modifica.addEventListener("click", () => apri(true));
  card.querySelector("#identita-annulla").addEventListener("click", () => apri(false));

  // Luce stato abbonamento (in alto a sinistra): toccandola compare/sparisce il bannerino.
  const luce = card.querySelector(".abbonamento-luce");
  const bannerAbb = card.querySelector(".abbonamento-banner");
  if (luce && bannerAbb) {
    const chiudiFuori = (ev) => {
      if (!luce.contains(ev.target)) {
        bannerAbb.hidden = true;
        document.removeEventListener("click", chiudiFuori);
      }
    };
    luce.addEventListener("click", (e) => {
      e.stopPropagation();
      const daMostrare = bannerAbb.hidden;
      bannerAbb.hidden = !daMostrare;
      if (daMostrare) setTimeout(() => document.addEventListener("click", chiudiFuori), 0);
      else document.removeEventListener("click", chiudiFuori);
    });
  }

  card.querySelectorAll(".col-opt").forEach((b) => {
    b.addEventListener("click", () => {
      coloreScelto = b.dataset.colore;
      applicaColore(coloreScelto); // anteprima immediata
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    const nome = card.querySelector("#id-nome").value.trim();
    const cognome = card.querySelector("#id-cognome").value.trim();
    if (!nome || !cognome) {
      errorEl.textContent = "Nome e cognome non possono essere vuoti";
      errorEl.hidden = false;
      return;
    }
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      await api.post("/profilo/me", {
        nickname: card.querySelector("#id-nickname").value.trim() || null,
        nome,
        cognome,
        cardColore: coloreScelto || null,
      });
      onSaved();
    } catch (err) {
      errorEl.textContent = err instanceof ApiError ? err.message : "Errore imprevisto";
      errorEl.hidden = false;
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

    const scalaCard = p.livello
      ? `<div class="card" style="margin-top:12px; text-align:center">
           <img src="/cards/card_final_${p.livello.attuale.numero}.png" alt="Livello ${p.livello.attuale.numero}"
                style="width:120px; height:120px; border-radius:12px; object-fit:cover" />
           <p class="mono" style="color:var(--mute); font-size:12px; margin-top:10px">Scala livelli</p>
           <div style="margin-top:8px">${scalaLivelliHtml(p.livello)}</div>
         </div>`
      : "";

    const progressiCard = `
      <div class="card" style="margin-top:12px">
        <p class="sezione-label">I tuoi progressi</p>
        <div style="display:flex; justify-content:space-around; text-align:center; margin-top:14px">
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
      </div>
    `;

    const badgeCard = `
      <div class="card" style="margin-top:12px">
        <p class="sezione-label">I tuoi badge</p>
        <div style="margin-top:12px">${trofeiRigaHtml(p.trofei)}</div>
      </div>`;

    content.innerHTML = `
      ${identitaCardHtml(p)}
      ${scalaCard}
      ${datiPersonaliCardHtml(p)}
      ${obiettiviCardHtml(p)}
      ${badgeCard}
      ${progressiCard}
      ${impostazioniCardHtml()}
    `;

    // Colore d'accento scelto dall'atleta: applicato come --accent sul wrapper, così
    // barrette .sezione-label, link e bottoni prendono quel colore; la classe
    // .ha-colore aggiunge la tinta tenue su sfondo/bordo di tutte le schede.
    if (p.cardColore) content.style.setProperty("--accent", p.cardColore);
    else content.style.removeProperty("--accent");
    content.classList.toggle("ha-colore", !!p.cardColore);

    // L'atleta ha "Esci" dentro Impostazioni — via il pulsante di primo livello
    // (resta solo per la coach, che non ha la card Impostazioni).
    el.querySelector("#logout-btn")?.remove();

    attachFotoUpload(content, () => loadProfilo(el));
    initIdentita(content, p, () => loadProfilo(el));
    initDatiPersonali(content, () => loadProfilo(el));
    initPersonalizza(content, p, () => loadProfilo(el));
    initNotifiche(content);
    initSicurezza(content);
    content.querySelector("#impostazioni-logout")?.addEventListener("click", async () => {
      await logout();
      navigate("/login");
    });
  } catch (err) {
    content.innerHTML = `<p class="error-text">${err instanceof ApiError ? err.message : "Errore imprevisto"}</p>`;
  }
}
