import { renderTabbar } from "../components/tabbar.js";
import { api, ApiError } from "../api.js";
import { CATEGORIE_RICHIESTA, etichettaCategoria } from "../richieste-categorie.js";
import { costruisciQuestionario } from "../components/questionario.js";
import { FEEDBACK_MENSILE_DOMANDE } from "../feedback-mensile-domande.js";

// Scala fissa del feedback "Com'è andata oggi?" — sempre queste 5 faccine, in quest'ordine,
// mai sostituite con stelle, slider, numeri o altre emoji.
const FACCE = [
  { valore: 1, emoji: "😫", titolo: "Pessima giornata" },
  { valore: 2, emoji: "😕", titolo: "Non benissimo" },
  { valore: 3, emoji: "😐", titolo: "Nella media" },
  { valore: 4, emoji: "🙂", titolo: "Andata bene" },
  { valore: 5, emoji: "🔥", titolo: "Fantastico" },
];

// Seconda (e ultima) domanda del feedback: "Come ti è sembrato l'allenamento?" — 4 livelli,
// faccina + parola. Distinte dalle 5 faccine fisse di "Com'è andata oggi?".
const DIFFICOLTA = [
  { valore: "facile", emoji: "😌", label: "Facile" },
  { valore: "giusto", emoji: "💪", label: "Giusto" },
  { valore: "impegnativo", emoji: "😤", label: "Impegnativo" },
  { valore: "tostissimo", emoji: "🥵", label: "Tostissimo" },
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

// Overlay a schermo intero per guardare un'immagine da vicino (card del livello in Home).
// Si chiude toccando ovunque o con Esc.
function apriLightbox(src, alt = "") {
  const ov = document.createElement("div");
  ov.style.cssText =
    "position:fixed; inset:0; z-index:100; background:rgba(0,0,0,0.85); display:flex; align-items:center; justify-content:center; padding:24px; cursor:zoom-out";
  ov.innerHTML = `<img src="${src}" alt="${alt}" style="max-width:100%; max-height:100%; object-fit:contain; border-radius:12px" />`;
  const chiudi = () => {
    ov.remove();
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e) => {
    if (e.key === "Escape") chiudi();
  };
  ov.addEventListener("click", chiudi);
  document.addEventListener("keydown", onKey);
  document.body.appendChild(ov);
}

// Le richieste di oggi (nome + testo libero) sono scritte dagli atleti e ora visibili a
// tutto il gruppo: vanno messe nell'HTML come testo, non come markup.
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

export function renderHome(appEl) {
  const oggi = new Date();
  const el = document.createElement("div");
  el.className = "screen";
  el.innerHTML = `
    <style>
      /* QUESTA SETTIMANA: le 3 sessioni affiancate. Quella di oggi è un <button> toccabile. */
      #timeline-card .giorni-riga { display: flex; gap: 8px; margin-top: 10px; }
      #timeline-card .giorno-tile {
        flex: 1; min-width: 0; text-align: center; padding: 12px 4px;
        border: 1px solid var(--border); border-radius: 12px;
        background: none; color: inherit; font-family: inherit;
      }
      #timeline-card .giorno-tile.oggi { border-color: var(--accent); cursor: pointer; }
      #timeline-card .giorno-tile.dim { opacity: 0.5; }
      #timeline-card .giorno-tile:disabled { opacity: 0.5; cursor: default; }
      /* Sessione in corso adesso: il giorno "respira" con un lampeggio fioco e lento. */
      #timeline-card .giorno-tile.live { animation: gt-live 1.7s ease-in-out infinite; }
      @keyframes gt-live { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      @media (prefers-reduced-motion: reduce) {
        #timeline-card .giorno-tile.live { animation: none; opacity: 0.7; }
      }
      #timeline-card .gt-nome { font-size: 14px; font-weight: 600; margin: 0; }
      #timeline-card .gt-ora { font-size: 10px; color: var(--mute); margin: 3px 0 0; }
      #timeline-card .gt-stato { font-size: 10px; letter-spacing: 1px; margin: 6px 0 0; }
      #timeline-card .gt-hint { font-size: 9px; color: var(--mute); opacity: 0.75; margin: 4px 0 0; }

      /* "Il tuo allenamento di oggi": un'unica card con dentro il messaggio della coach,
         "Prima dell'allenamento" (richieste) e "Post allenamento" (feedback). Le sezioni
         vuote spariscono; i separatori compaiono solo tra sezioni piene. */
      #allenamento-oggi-card > .ao-sezione:empty { display: none; }
      #allenamento-oggi-card #ao-coach { margin-top: 12px; }
      #allenamento-oggi-card #ao-richieste { margin-top: 16px; }
      #allenamento-oggi-card #ao-presenze { margin-top: 14px; }
      #allenamento-oggi-card #ao-feedback {
        margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border);
      }
      #allenamento-oggi-card #ao-coach:empty + #ao-richieste { margin-top: 12px; }
      #allenamento-oggi-card #ao-richieste:empty + #ao-feedback { border-top: none; padding-top: 0; margin-top: 12px; }

      /* Feedback: "Com'è andata oggi?" — le 5 faccine su una linea sfumata. Solo la linea
         sta qui (pseudo-elemento); faccine e stato selezionato sono stile inline nel JS,
         come il resto della home (i <button> nativi ignorano box-shadow senza appearance). */
      #ao-feedback .fb-track {
        position: relative; display: flex; justify-content: space-between;
        align-items: center; padding: 6px 2px; margin-top: 12px;
      }
      #ao-feedback .fb-track::before {
        content: ""; position: absolute; left: 16px; right: 16px; top: 50%; height: 3px;
        transform: translateY(-50%); border-radius: 2px; opacity: 0.4;
        background: linear-gradient(90deg, var(--livello-5), var(--livello-3) 52%, var(--livello-1));
      }
    </style>
    <h1 style="letter-spacing:0.5px">100FT</h1>
    <p id="saluto-nome" style="font-size:17px; margin-top:2px">&nbsp;</p>
    <p class="mono" style="color:var(--mute); font-size:13px; letter-spacing:1px; margin-top:6px">
      ${GIORNI[(oggi.getDay() + 6) % 7].toUpperCase()} · ${oggi.getDate()} ${MESI[oggi.getMonth()].toUpperCase()}
    </p>
    <div class="card" id="settimana-card" style="margin-top:20px">
      <p class="mono" style="color:var(--mute)">Carico...</p>
    </div>
    <div class="card" id="feedback-mese-card" hidden style="margin-top:12px"></div>
    <div class="card" id="timeline-card" style="margin-top:12px">
      <p class="mono" style="color:var(--mute)">Carico...</p>
    </div>
    <div class="card" id="allenamento-oggi-card" style="margin-top:12px">
      <p class="mono" id="ao-titolo" style="font-size:12px; letter-spacing:1px">IL TUO ALLENAMENTO DI OGGI</p>
      <div id="ao-empty" hidden>
        <p class="mono" style="color:var(--mute); font-size:13px">Oggi non è un giorno di allenamento.</p>
      </div>
      <div class="ao-sezione" id="ao-coach"></div>
      <div class="ao-sezione" id="ao-richieste"></div>
      <div class="ao-sezione" id="ao-presenze"></div>
      <div class="ao-sezione" id="ao-feedback"></div>
    </div>
  `;
  appEl.appendChild(el);
  appEl.appendChild(renderTabbar());

  loadSettimana(el);
  loadFeedbackMese(el);
  loadTimeline(el);
  loadAllenamentoOggi(el);
}

// Questionario mensile — feedback guidato sul mese appena concluso. La card compare solo
// se c'è un feedback da dare (finché non è inviato); poi sparisce.
async function loadFeedbackMese(el) {
  const card = el.querySelector("#feedback-mese-card");
  if (!card) return;

  let stato;
  try {
    stato = await api.get("/feedback-mensile/stato");
  } catch {
    card.remove();
    return;
  }
  // Si compila solo la prima settimana del mese (giorni 1–7), una volta sola.
  if (stato.giaInviato || !stato.disponibile) {
    card.remove();
    return;
  }

  const meseNome = MESI[(stato.mese - 1 + 12) % 12];
  card.hidden = false;
  card.innerHTML = `
    <p class="mono" style="color:var(--mute); font-size:12px; letter-spacing:1px">FEEDBACK DI ${meseNome.toUpperCase()} · 2 MIN</p>
    <div id="fm-vista" style="margin-top:8px">
      <p style="font-size:14px">Com'è andato il mese? Raccontacelo con qualche tocco — aiuta la coach a lavorare meglio con te.</p>
      <button class="btn" type="button" id="fm-apri" style="width:100%; margin-top:10px">Inizia</button>
    </div>
    <form id="fm-form" hidden style="margin-top:12px">
      <div id="fm-domande"></div>
      <p class="error-text" id="fm-error" hidden></p>
      <button class="btn" type="submit" style="width:100%">Invia</button>
    </form>
  `;

  let q = null;
  const vista = card.querySelector("#fm-vista");
  const form = card.querySelector("#fm-form");

  card.querySelector("#fm-apri").addEventListener("click", () => {
    q = costruisciQuestionario(form.querySelector("#fm-domande"), FEEDBACK_MENSILE_DOMANDE, {});
    vista.hidden = true;
    form.hidden = false;
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = form.querySelector("#fm-error");
    errorEl.hidden = true;
    const risposte = q ? q.getRisposte() : {};
    if (Object.keys(risposte).length === 0) {
      errorEl.textContent = "Rispondi ad almeno una domanda";
      errorEl.hidden = false;
      return;
    }
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      await api.post("/feedback-mensile", { risposte });
      card.remove();
    } catch (err) {
      errorEl.textContent = err instanceof ApiError ? err.message : "Errore imprevisto";
      errorEl.hidden = false;
      btn.disabled = false;
    }
  });
}

// "Il tuo allenamento di oggi" — orchestra le tre sotto-sezioni nella card unica e mostra
// il countdown al prossimo allenamento se oggi non c'è nulla (niente sessione, niente
// messaggio della coach).
async function loadAllenamentoOggi(el) {
  // "Prima dell'allenamento" (richieste: parte alta / bassa / ecc.) nascosta per ora —
  // riattivare rimettendo `loadRichieste(el)` qui e `"#ao-richieste"` nella lista sotto.
  await Promise.all([loadCoach(el), loadPresenzeOggi(el), loadFeedback(el)]);
  const card = el.querySelector("#allenamento-oggi-card");
  if (!card) return;
  const vuoto = ["#ao-coach", "#ao-presenze", "#ao-feedback"].every(
    (sel) => !card.querySelector(sel)?.innerHTML.trim()
  );
  const box = card.querySelector("#ao-empty");
  box.hidden = !vuoto;
  // Il titolo "IL TUO ALLENAMENTO DI OGGI" ha senso solo quando oggi c'è qualcosa;
  // col countdown al prossimo allenamento sparisce.
  card.querySelector("#ao-titolo").hidden = vuoto;

  if (!vuoto) {
    fermaCountdown();
    return;
  }
  try {
    const { sessioniSettimana } = await api.get("/profilo/me");
    avviaCountdown(box, sessioniSettimana);
  } catch {
    fermaCountdown();
    box.innerHTML = `<p class="mono" style="color:var(--mute); font-size:13px">Oggi non è un giorno di allenamento.</p>`;
  }
}

// --- Countdown al prossimo allenamento -------------------------------------------------
// Le sessioni sono un pattern settimanale ricorrente (lun/mer/ven). Dalla lista di questa
// settimana ricaviamo il prossimo inizio: la sessione futura più vicina, proiettata alla
// settimana dopo se tutte quelle di questa settimana sono già passate. L'orario ("19:30")
// è ora locale = ora di Roma per gli atleti (stessa approssimazione del resto dell'app).
let countdownTimer = null;
let timelineRefresh = null;

function fermaCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

function prossimoInizio(sessioni) {
  const ora = Date.now();
  const SETTIMANA = 7 * 24 * 3600 * 1000;
  let migliore = null;
  for (const s of sessioni ?? []) {
    if (!s.data || !s.oraInizio) continue;
    let ts = new Date(`${s.data}T${s.oraInizio}:00`).getTime();
    if (Number.isNaN(ts)) continue;
    if (ts <= ora) ts += SETTIMANA;
    if (migliore == null || ts < migliore.ts) migliore = { ts, oraInizio: s.oraInizio };
  }
  return migliore;
}

function formattaResto(ms) {
  const tot = Math.max(0, Math.floor(ms / 1000));
  const g = Math.floor(tot / 86400);
  const h = Math.floor((tot % 86400) / 3600);
  const m = Math.floor((tot % 3600) / 60);
  const s = tot % 60;
  const parti = [];
  if (g) parti.push(`${g} ${g === 1 ? "giorno" : "giorni"}`);
  if (g || h) parti.push(`${h} h`);
  parti.push(`${m} min`);
  parti.push(`${s} sec`);
  return parti.join(" · ");
}

function battuta(ms) {
  const min = ms / 60000;
  if (min < 15) return "scaldati, si parte 🔥";
  if (min < 60) return "manca pochissimo 👀";
  if (min < 24 * 60) return "ci siamo quasi 💪";
  if (min < 48 * 60) return "preparati 💪";
  return "ci vediamo in sala 💪";
}

function avviaCountdown(box, sessioni) {
  fermaCountdown();
  const prossima = prossimoInizio(sessioni);
  if (!prossima) {
    box.innerHTML = `<p class="mono" style="color:var(--mute); font-size:13px">Nessun allenamento in programma.</p>`;
    return;
  }
  const giorno = GIORNI[(new Date(prossima.ts).getDay() + 6) % 7];
  box.innerHTML = `
    <p class="kicker" style="color:var(--accent); font-size:11px">Prossimo allenamento</p>
    <p id="cd-tempo" style="font-family:var(--font-ui); font-weight:700; font-size:15px; letter-spacing:-0.2px; margin-top:5px">—</p>
    <p class="mono" style="color:var(--mute); font-size:11px; margin-top:4px"><span id="cd-battuta"></span> · ${giorno} ${prossima.oraInizio}</p>
  `;
  const tempoEl = box.querySelector("#cd-tempo");
  const battutaEl = box.querySelector("#cd-battuta");

  const tick = () => {
    if (!box.isConnected) return fermaCountdown();
    const resto = prossima.ts - Date.now();
    if (resto <= 0) {
      tempoEl.textContent = "È ora! 🔥";
      battutaEl.textContent = "in bocca al lupo";
      fermaCountdown();
      return;
    }
    tempoEl.textContent = formattaResto(resto);
    battutaEl.textContent = battuta(resto);
  };
  tick();
  countdownTimer = setInterval(tick, 1000);
}

function anelliSvg({ training, challenges, feedback }) {
  const pctTraining = training.totali > 0 ? Math.min(1, training.fatti / training.totali) : 0;
  const pctChallenges = challenges.totali > 0 ? Math.min(1, challenges.fatte / challenges.totali) : 0;
  const pctFeedback = feedback.totali > 0 ? Math.min(1, feedback.fatti / feedback.totali) : 0;

  const anelli = [
    { r: 40, pct: pctTraining, colore: "var(--accent)" },
    { r: 27, pct: pctChallenges, colore: "var(--sessione-extra)" },
    { r: 14, pct: pctFeedback, colore: "var(--livello-1)" },
  ];

  const cerchi = anelli
    .map(({ r, pct, colore }) => {
      const circ = 2 * Math.PI * r;
      const dash = circ * pct;
      return `
        <circle cx="50" cy="50" r="${r}" fill="none" stroke="${colore}" stroke-width="12" opacity="0.22" />
        <circle cx="50" cy="50" r="${r}" fill="none" stroke="${colore}" stroke-width="12" stroke-linecap="round"
          stroke-dasharray="${circ}" stroke-dashoffset="${circ - dash}" transform="rotate(-90 50 50)" />
      `;
    })
    .join("");

  return `<svg width="100" height="100" viewBox="0 0 100 100">${cerchi}</svg>`;
}

// LA TUA ATTIVITÀ — i 3 anelli + livello. Logica invariata, solo presentazione.
async function loadSettimana(el) {
  const card = el.querySelector("#settimana-card");
  try {
    const { nome, nickname, anelli, livello } = await api.get("/profilo/me");

    const saluto = el.querySelector("#saluto-nome");
    if (saluto) saluto.textContent = `Bentornato ${nickname || nome || ""}`.trim();

    const rigaLegenda = (colore, etichetta, fatti, totali) => {
      const conteggio = totali > 0 ? `${fatti} / ${totali}` : "—";
      return `
      <div>
        <p style="font-size:12px"><span style="color:${colore}">●</span> ${etichetta.toUpperCase()}</p>
        <p style="margin-top:2px"><strong>${conteggio}</strong> <span class="mono" style="color:var(--mute); font-size:12px">Attività</span></p>
      </div>
    `;
    };

    const legenda = `
      <div style="display:flex; flex-direction:column; gap:10px; justify-content:center">
        ${rigaLegenda("var(--accent)", "Allenamenti", anelli.training.fatti, anelli.training.totali)}
        ${rigaLegenda("var(--sessione-extra)", "Sfide", anelli.challenges.fatte, anelli.challenges.totali)}
        ${rigaLegenda("var(--livello-1)", "Feedback", anelli.feedback.fatti, anelli.feedback.totali)}
      </div>
    `;

    let livelloHtml = "";
    if (livello) {
      const { attuale, prossimo, allenamentiFatti } = livello;
      // Sotto il livello 1 (< 3 allenamenti) `attuale` e `prossimo` coincidono: la barra
      // parte da 0, non dalla soglia del livello attuale.
      const inRodaggio = prossimo && prossimo.numero === attuale.numero;
      const base = prossimo && !inRodaggio ? attuale.allenamentiMin : 0;
      const range = prossimo ? Math.max(1, prossimo.allenamentiMin - base) : 1;
      const progresso = prossimo ? Math.max(0, allenamentiFatti - base) : range;
      const pctBarra = prossimo ? Math.min(100, Math.round((progresso / range) * 100)) : 100;

      const allenText = prossimo
        ? `${allenamentiFatti}/${prossimo.allenamentiMin} allenamenti al prossimo livello`
        : `${allenamentiFatti} allenamenti · livello massimo`;

      livelloHtml = `
        <div style="display:flex; gap:14px; margin-top:14px; padding-top:12px; border-top:1px solid var(--border)">
          <img class="livello-img" src="/cards/card_final_${attuale.numero}.png" alt="Livello ${attuale.numero} — ${attuale.nome}"
               style="width:64px; height:64px; border-radius:10px; object-fit:cover; flex-shrink:0; cursor:zoom-in; background:#141414; padding:3px" />
          <div style="flex:1; min-width:0; display:flex; flex-direction:column; justify-content:space-between; padding:1px 0">
            <p class="mono" style="color:${attuale.colore}; font-size:11px; margin:0">
              LIVELLO ${attuale.numero} · ${attuale.nome.toUpperCase()}
            </p>
            <div style="background:var(--surface-2); background:color-mix(in srgb, ${attuale.colore} 20%, transparent); border-radius:4px; height:5px; overflow:hidden">
              <div style="background:${attuale.colore}; width:${pctBarra}%; height:100%"></div>
            </div>
            <p class="mono" style="color:var(--mute); font-size:11px; margin:0">${allenText}</p>
          </div>
        </div>
      `;
    }

    card.innerHTML = sezione(
      "LA TUA ATTIVITÀ",
      `
        <div style="display:flex; align-items:center; gap:16px; margin-top:10px">
          ${anelliSvg(anelli)}
          ${legenda}
        </div>
        ${livelloHtml}
      `
    );

    const img = card.querySelector(".livello-img");
    if (img) img.addEventListener("click", () => apriLightbox(img.src, img.alt));
  } catch {
    card.remove();
  }
}

// QUESTA SETTIMANA — le 3 sessioni (Lun/Mer/Ven) affiancate su una riga. La sessione di
// OGGI è sempre toccabile per cambiare presenza/assenza nel giorno stesso; passate e future
// sono solo di lettura.
async function loadTimeline(el) {
  const card = el.querySelector("#timeline-card");
  try {
    const { sessioniSettimana } = await api.get("/profilo/me");
    const oggiIso = new Date().toISOString().slice(0, 10);

    const ora = new Date();
    const tassello = (s) => {
      const giorno = nomeGiorno(s.data).slice(0, 3).toUpperCase(); // LUN / MER / VEN
      const orario = `${s.oraInizio}–${s.oraFine}`;
      const passato = s.data < oggiIso;
      const futuro = s.data > oggiIso;
      const oggi = !passato && !futuro;

      // Orari "19:30" = ora locale = ora di Roma per gli atleti (stessa approssimazione
      // del resto dell'app).
      const iniziata = new Date(`${s.data}T${s.oraInizio}:00`) <= ora;
      const finita = new Date(`${s.data}T${s.oraFine}:00`) <= ora;
      const live = oggi && iniziata && !finita;
      // Occasione di partecipare finita: chi non ha risposto entro qui conta come assente.
      const conclusa = passato || (oggi && finita);

      const chiuso = s.stato === "chiuso";
      const cliccabile = oggi && !chiuso;

      let segno = "";
      let stato = "";
      let statoColore = "var(--mute)";
      if (chiuso) {
        segno = "— ";
        stato = "CHIUSO";
      } else if (s.stato === "presente") {
        segno = "✓ ";
        stato = "PRESENTE";
        statoColore = "var(--livello-1)"; // verde
      } else if (s.stato === "in_attesa") {
        segno = conclusa ? "◔ " : "● ";
        stato = conclusa ? "IN ATTESA" : "PRENOTATO";
        statoColore = conclusa ? "var(--mute)" : "var(--accent)";
      } else if (s.stato === "assente" || (s.stato === "indeciso" && conclusa)) {
        segno = "✗ ";
        stato = "ASSENTE";
        statoColore = "var(--livello-5)"; // rosso
      } else {
        segno = oggi ? "● " : "○ ";
        stato = oggi ? "CI SEI?" : "—";
      }

      // I giorni passati con un esito (presente/assente) restano leggibili; si smorzano
      // solo i futuri, i chiusi e i passati senza risposta.
      const conEsito = s.stato === "presente" || stato === "ASSENTE";
      const dim = chiuso || futuro || (!oggi && !conEsito);
      const cls = `giorno-tile${cliccabile ? " oggi" : ""}${live && !chiuso ? " live" : ""}${dim ? " dim" : ""}`;

      const corpo = `
        <p class="gt-nome">${segno}${giorno}</p>
        <p class="gt-ora mono">${chiuso ? "festività / chiusura" : orario}</p>
        <p class="gt-stato mono" style="color:${statoColore}">${stato}</p>
        ${cliccabile ? `<p class="gt-hint mono">${s.stato === "indeciso" ? "tocca per prenotare" : s.stato === "in_attesa" ? "tocca per annullare" : "tocca per cambiare"}</p>` : ""}
      `;

      return cliccabile
        ? `<button type="button" class="${cls}" data-stato="${s.stato}">${corpo}</button>`
        : `<div class="${cls}">${corpo}</div>`;
    };

    card.innerHTML = sezione(
      "QUESTA SETTIMANA",
      `<div class="giorni-riga">${sessioniSettimana.map(tassello).join("")}</div>`
    );

    // Se una sessione è in corso, ridisegna la timeline alla sua fine (il lampeggio si
    // spegne e lo stato "non risposto" diventa ASSENTE da solo, senza refresh manuale).
    if (timelineRefresh) clearTimeout(timelineRefresh);
    const oggiSess = sessioniSettimana.find((s) => s.data === oggiIso);
    if (oggiSess) {
      const fineMs = new Date(`${oggiSess.data}T${oggiSess.oraFine}:00`) - new Date();
      if (fineMs > 0 && fineMs < 6 * 3600 * 1000) {
        timelineRefresh = setTimeout(() => loadTimeline(el), fineMs + 1000);
      }
    }

    card.querySelector(".giorno-tile.oggi")?.addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      // Se ha già prenotato (o è confermato presente) il tocco annulla, altrimenti prenota.
      const presente = !["in_attesa", "presente"].includes(btn.dataset.stato);
      btn.disabled = true;
      try {
        await api.post("/presenze/conferma", { presente });
        loadSettimana(el);
        loadTimeline(el);
        loadPresenzeOggi(el);
        loadFeedback(el);
      } catch {
        btn.disabled = false;
      }
    });
  } catch (err) {
    card.innerHTML = `<p class="error-text">${err instanceof ApiError ? err.message : "Errore imprevisto"}</p>`;
  }
}

// Messaggio della coach per oggi — dentro "Il tuo allenamento di oggi", mostrato solo
// quando c'è davvero qualcosa da dire (mai il contenuto della lezione).
async function loadCoach(el) {
  const box = el.querySelector("#ao-coach");
  try {
    const { testo } = await api.get("/nota-coach");
    box.innerHTML = testo ? `<p style="font-style:italic">"${esc(testo)}"</p>` : "";
  } catch {
    box.innerHTML = "";
  }
}

// Menu a tendina "Chi viene oggi": chi ha messo presente e chi no per l'allenamento di
// oggi. Visibile a tutti gli atleti (si vedono comunque in sala).
async function loadPresenzeOggi(el) {
  const box = el.querySelector("#ao-presenze");
  try {
    const { sessione, roster } = await api.get("/presenze/oggi");
    if (!sessione || !roster?.length) {
      box.innerHTML = "";
      return;
    }
    const presenti = roster.filter((r) => r.presente);
    const assenti = roster.filter((r) => !r.presente);
    const elenco = (arr, colore) =>
      arr.length
        ? `<div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:6px">
             ${arr
               .map(
                 (r) =>
                   `<span class="mono" style="font-size:12px; background:var(--surface-2); border-radius:999px; padding:4px 10px">
                      <span style="color:${colore}">●</span> ${esc(r.nome)}
                    </span>`
               )
               .join("")}
           </div>`
        : `<p class="mono" style="color:var(--mute); font-size:12px; margin-top:6px">—</p>`;

    box.innerHTML = `
      <details>
        <summary class="mono" style="cursor:pointer; color:var(--mute); font-size:12px; letter-spacing:1px">
          CHI VIENE OGGI · ${presenti.length}/${roster.length}
        </summary>
        <div style="margin-top:8px">
          <p class="mono" style="color:var(--mute); font-size:11px; letter-spacing:1px">HANNO MESSO PRESENTE</p>
          ${elenco(presenti, "var(--livello-1)")}
          <p class="mono" style="color:var(--mute); font-size:11px; letter-spacing:1px; margin-top:10px">NON HANNO ANCORA CONFERMATO</p>
          ${elenco(assenti, "var(--mute)")}
        </div>
      </details>
    `;
  } catch {
    box.innerHTML = "";
  }
}

// Sezione 7: RICHIESTA DELL'ALLIEVO — chiude alle 13:00, poi resta visibile ma non interattiva.
// Le richieste di oggi sono pubbliche tra gli atleti: ognuno vede cosa hanno chiesto gli altri.
const RICH_PILL_OFF =
  "background:var(--surface-2); border:1px solid var(--border); border-radius:999px; padding:7px 12px; font-size:12px; color:var(--text); cursor:pointer; font-family:inherit";
const RICH_PILL_ON =
  "background:var(--accent); border:1px solid var(--accent); border-radius:999px; padding:7px 12px; font-size:12px; color:#fff; cursor:pointer; font-family:inherit";

async function loadRichieste(el) {
  const card = el.querySelector("#ao-richieste");
  try {
    const { sessione, aperte, inviata, richieste, conteggi } = await api.get("/richieste/oggi");

    if (!sessione) {
      card.innerHTML = "";
      return;
    }

    // Conteggi per categoria — quante persone hanno chiesto cosa (visti da tutti).
    const conteggiHtml = conteggi && conteggi.length
      ? `
        <p class="mono" style="color:var(--mute); font-size:11px; letter-spacing:1px; margin-top:16px">CONTEGGIO RICHIESTE</p>
        <p class="mono" style="font-size:13px; margin-top:4px; line-height:1.8">
          ${conteggi.map((x) => `${esc(etichettaCategoria(x.categoria))}&nbsp;<strong>${x.n}</strong>`).join(" · ")}
        </p>`
      : "";

    const elencoHtml = richieste.length
      ? `
        <p class="mono" style="color:var(--mute); font-size:11px; letter-spacing:1px; margin-top:16px">LE RICHIESTE DI OGGI</p>
        <div style="margin-top:2px">
          ${richieste
            .map(
              (r) => `
                <div style="border-top:1px solid var(--border); padding:8px 0">
                  <p style="font-size:14px"><strong>${esc(r.nickname || r.nome)}</strong></p>
                  ${r.categoria ? `<p class="mono" style="color:var(--accent); font-size:13px; margin-top:2px">${esc(etichettaCategoria(r.categoria))}</p>` : ""}
                  ${r.testoLibero ? `<p style="font-size:13px; margin-top:2px">${esc(r.testoLibero)}</p>` : ""}
                </div>
              `
            )
            .join("")}
        </div>
      `
      : "";

    if (inviata) {
      card.innerHTML = `<p>Richiesta inviata ✓</p>${conteggiHtml}${elencoHtml}`;
      return;
    }

    if (!aperte) {
      card.innerHTML = `
        <p style="font-weight:600">RICHIESTA CHIUSA</p>
        <p class="mono" style="color:var(--mute); font-size:13px; margin-top:4px">La coach vedrà la tua richiesta prima della sessione.</p>
        ${conteggiHtml}
        ${elencoHtml}
      `;
      return;
    }

    card.innerHTML = `
      <p>C'è qualcosa su cui vorresti lavorare oggi?</p>
      <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:10px" id="categoria-scelte">
        ${CATEGORIE_RICHIESTA.map((c) => `<button type="button" class="categoria-btn" data-cat="${esc(c.v)}" style="${RICH_PILL_OFF}">${c.emoji} ${c.v}</button>`).join("")}
      </div>
      <p class="error-text" id="richiesta-error" hidden style="margin-top:6px"></p>
      <button class="btn" id="richiesta-submit" style="width:100%; margin-top:10px">Invia richiesta</button>
      ${conteggiHtml}
      ${elencoHtml}
    `;

    let categoriaScelta = null;
    const bottoni = card.querySelectorAll(".categoria-btn");
    bottoni.forEach((b) => {
      b.addEventListener("click", () => {
        const giaAttivo = categoriaScelta === b.dataset.cat;
        categoriaScelta = giaAttivo ? null : b.dataset.cat;
        bottoni.forEach((x) => (x.style.cssText = x.dataset.cat === categoriaScelta ? RICH_PILL_ON : RICH_PILL_OFF));
      });
    });

    card.querySelector("#richiesta-submit").addEventListener("click", async (e) => {
      const errorEl = card.querySelector("#richiesta-error");
      errorEl.hidden = true;
      if (!categoriaScelta) {
        errorEl.textContent = "Scegli una categoria";
        errorEl.hidden = false;
        return;
      }
      e.target.disabled = true;
      try {
        await api.post("/richieste", { categoria: categoriaScelta });
        loadRichieste(el);
      } catch (err) {
        errorEl.textContent = err instanceof ApiError ? err.message : "Errore imprevisto";
        errorEl.hidden = false;
        e.target.disabled = false;
      }
    });
  } catch {
    card.innerHTML = "";
  }
}

// "Post allenamento" — feedback: bloccato prima della fine sessione, "sessione non
// frequentata" per chi non c'era, il questionario a 2 domande per chi era presente.
async function loadFeedback(el) {
  const card = el.querySelector("#ao-feedback");
  try {
    const { sessione, richiesta } = await api.get("/presenze/oggi");

    if (!sessione) {
      card.innerHTML = "";
      return;
    }

    // Ora locale (= ora di Roma per gli atleti), come la timeline "QUESTA SETTIMANA":
    // niente "Z", altrimenti il feedback resta bloccato ~2 h dopo la fine reale.
    const finita = new Date(`${new Date().toISOString().slice(0, 10)}T${sessione.ora_fine}:00`) <= new Date();

    if (!finita) {
      card.innerHTML = sezione(
        "POST ALLENAMENTO",
        `<p style="margin-top:8px; display:flex; align-items:center; gap:6px">
          <img src="/lucchetto.png" alt="Bloccato" style="width:16px; height:16px" />
          <span class="mono" style="color:var(--mute); font-size:13px">Disponibile dopo la sessione</span>
        </p>`
      );
      return;
    }

    if (!richiesta) {
      card.innerHTML = sezione(
        "POST ALLENAMENTO",
        `<p class="mono" style="color:var(--mute); font-size:13px; margin-top:8px">SESSIONE NON FREQUENTATA</p>`
      );
      return;
    }

    const { sessioni } = await api.get("/feedback/da-dare");
    const daDare = sessioni.find((s) => s.sessioneId === sessione.id) ?? null;

    if (!daDare) {
      card.innerHTML = sezione("POST ALLENAMENTO", `<p style="margin-top:8px">Feedback inviato ✓</p>`);
      return;
    }

    const facciaStyle =
      "position:relative; font-size:26px; line-height:1; width:42px; height:42px; border:none; border-radius:50%; background:var(--bg); cursor:pointer; padding:0; outline-offset:2px";
    const diffStyle =
      "flex:1; min-width:0; min-height:58px; padding:8px 3px; border:1px solid var(--border); border-radius:11px; background:var(--surface-2); color:var(--text); cursor:pointer; font-family:inherit; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px";

    card.innerHTML = sezione(
      "POST ALLENAMENTO",
      `
        <p class="mono" style="color:var(--mute); font-size:12px; letter-spacing:1px; margin-top:10px">COM'È ANDATA OGGI?</p>
        <div class="fb-track">
          ${FACCE.map(
            (f) => `
              <button type="button" class="fb-faccia" data-valore="${f.valore}" data-label="${f.titolo}"
                title="${f.titolo}" aria-label="${f.titolo}" style="${facciaStyle}">${f.emoji}</button>
            `
          ).join("")}
        </div>
        <div style="display:flex; justify-content:space-between; font-size:10px; letter-spacing:1px; color:var(--mute); margin-top:6px; padding:0 2px" class="mono">
          <span>Pessima</span><span>Fantastica</span>
        </div>
        <p class="mono" id="fb-current" style="text-align:center; margin-top:10px; font-size:14px; font-weight:600; min-height:1.2em"></p>

        <p class="mono" style="color:var(--mute); font-size:12px; letter-spacing:1px; margin-top:16px">COME TI È SEMBRATO L'ALLENAMENTO?</p>
        <div style="display:flex; gap:6px; margin-top:8px">
          ${DIFFICOLTA.map(
            (d) => `
              <button type="button" class="fb-diff-btn" data-valore="${d.valore}" aria-label="${d.label}" style="${diffStyle}">
                <span style="font-size:22px; line-height:1">${d.emoji}</span>
                <span class="fb-diff-l mono" style="font-size:10px; color:var(--mute); text-align:center">${d.label}</span>
              </button>
            `
          ).join("")}
        </div>

        <input id="feedback-nota" type="text" placeholder="Nota facoltativa"
               style="width:100%; margin-top:16px; background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:8px 10px; color:var(--text); font-size:13px" />
        <p class="error-text" id="feedback-error" hidden style="margin-top:6px"></p>
        <button class="btn" id="feedback-invia" style="width:100%; margin-top:10px">Invia feedback</button>
      `
    );

    let faccinaScelta = null;
    let difficoltaScelta = null;

    card.querySelectorAll(".fb-faccia").forEach((btn) => {
      btn.addEventListener("click", () => {
        faccinaScelta = Number(btn.dataset.valore);
        card.querySelectorAll(".fb-faccia").forEach((b) => {
          b.style.outline = b === btn ? "2px solid var(--accent)" : "none";
        });
        card.querySelector("#fb-current").textContent = btn.dataset.label;
      });
    });

    card.querySelectorAll(".fb-diff-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        difficoltaScelta = btn.dataset.valore;
        card.querySelectorAll(".fb-diff-btn").forEach((b) => {
          const on = b === btn;
          b.style.background = on ? "var(--accent)" : "var(--surface-2)";
          b.style.borderColor = on ? "var(--accent)" : "var(--border)";
          b.querySelector(".fb-diff-l").style.color = on ? "#fff" : "var(--mute)";
        });
      });
    });

    card.querySelector("#feedback-invia").addEventListener("click", async (e) => {
      const errorEl = card.querySelector("#feedback-error");
      errorEl.hidden = true;

      if (!faccinaScelta || !difficoltaScelta) {
        errorEl.textContent = "Scegli come è andata e come ti è sembrato l'allenamento prima di inviare";
        errorEl.hidden = false;
        return;
      }

      e.target.disabled = true;
      try {
        await api.post("/feedback", {
          sessioneId: sessione.id,
          data: daDare.data,
          faccina: faccinaScelta,
          difficolta: difficoltaScelta,
          nota: card.querySelector("#feedback-nota").value,
        });
        loadFeedback(el);
        loadSettimana(el);
      } catch (err) {
        errorEl.textContent = err instanceof ApiError ? err.message : "Errore imprevisto";
        errorEl.hidden = false;
        e.target.disabled = false;
      }
    });
  } catch (err) {
    card.innerHTML = `<p class="error-text">${err instanceof ApiError ? err.message : "Errore imprevisto"}</p>`;
  }
}
