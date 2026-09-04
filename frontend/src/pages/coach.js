// Libreria delle sezioni della dashboard coach. Ogni `init*` monta la sua UI dentro un `el`
// passato; le pagine in pages/coach/*.js le compongono (una per rotta) dentro lo shell.
import { api, ApiError, mediaUrl } from "../api.js";
import { etichettaCategoria } from "../richieste-categorie.js";
import { PIANI } from "../abbonamenti.js";

export const MESI = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

// Stile condiviso dei <select> della dashboard.
export const SEL_STYLE =
  "background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:10px 12px; color:var(--text); font-family:inherit; font-size:15px";

// Criteri per le sfide "traguardo": si completano da sole quando l'atleta li raggiunge.
export const CRITERI_TRAGUARDO = [
  { v: "profilo_completo", label: "ha completato profilo + «I tuoi dati»" },
  { v: "obiettivi_completi", label: "ha compilato gli obiettivi personali" },
  { v: "daily_drop", label: "ha fatto almeno un daily drop" },
  { v: "presenze", label: "raggiunge N presenze confermate" },
];

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// Riga leggibile per una sfida nell'elenco della dashboard.
export function descriviSfida(s) {
  if (s.tipo === "foto") return "📸 Foto";
  if (s.tipo !== "traguardo") return "👋 Di gruppo";
  const c = s.criterio || "";
  if (c === "profilo_completo") return "🏅 Automatica — profilo completo";
  if (c === "obiettivi_completi") return "🏅 Automatica — obiettivi compilati";
  if (c === "daily_drop") return "🏅 Automatica — un daily drop";
  const m = c.match(/^presenze:(\d+)$/);
  if (m) return `🏅 Automatica — ${m[1]} presenze`;
  return "🏅 Automatica";
}

// Primo e ultimo giorno (YYYY-MM-DD) di un mese dato anno + mese 1-12.
export function estremiMese(anno, mese) {
  return {
    inizio: `${anno}-${String(mese).padStart(2, "0")}-01`,
    fine: new Date(Date.UTC(anno, mese, 0)).toISOString().slice(0, 10),
  };
}

export function oraCorrente() {
  const now = new Date();
  return { mese: now.getUTCMonth() + 1, anno: now.getUTCFullYear() };
}

export function oggiIso() {
  return new Date().toISOString().slice(0, 10);
}

// Pagina "Oggi": il check delle info utili per il PROSSIMO allenamento.
export function initOggi(el) {
  const box = el.querySelector("#coach-oggi-body");
  box.innerHTML = `<p class="mono" style="color:var(--mute); font-size:13px">Carico...</p>`;

  const GIORNI = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];
  const etichettaGiorno = (iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    const g = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    return `${GIORNI[g]} ${d}/${m}`;
  };

  api.get("/presenze/prossima")
    .then((d) => {
      if (!d.data) {
        box.innerHTML = `
          <p style="font-size:14px">Nessun allenamento in programma nei prossimi giorni.</p>
          ${riepilogoAppello(d)}`;
        return;
      }

      const quando = d.oggi ? "oggi" : etichettaGiorno(d.data);
      const ora = d.sessione ? ` · ${d.sessione.oraInizio}–${d.sessione.oraFine}` : "";

      const voce = (ok, testo, azione) => `
        <div style="display:flex; gap:10px; align-items:flex-start; padding:10px 0; border-top:1px solid var(--border)">
          <span style="font-size:15px; flex-shrink:0">${ok ? "✓" : "○"}</span>
          <div style="flex:1; min-width:0">
            <p style="font-size:14px">${testo}</p>
            ${azione ? `<p class="mono" style="font-size:12px; margin-top:2px">${azione}</p>` : ""}
          </div>
        </div>`;

      const nomiPrenotati = d.prenotati.length
        ? `<details style="margin-top:4px"><summary class="mono" style="font-size:12px; color:var(--mute); cursor:pointer">chi ha prenotato</summary>
             <p style="font-size:13px; margin-top:4px">${d.prenotati.map(esc).join(" · ")}</p></details>`
        : "";

      const richiesteHtml = d.oggi && d.richieste.length
        ? d.richieste
            .map(
              (r) => `<p style="font-size:13px; margin-top:2px"><strong>${esc(r.nome)}</strong>${
                r.categoria ? ` · <span style="color:var(--accent)">${etichettaCategoria(r.categoria)}</span>` : ""
              }${r.testoLibero ? ` · ${esc(r.testoLibero)}` : ""}</p>`
            )
            .join("")
        : "";

      box.innerHTML = `
        <p class="mono" style="color:var(--mute); font-size:12px">Prossimo allenamento: <strong style="color:var(--text)">${quando}</strong>${ora}</p>
        ${voce(!!d.nota, d.nota ? `Nota per ${quando}: <em>"${esc(d.nota)}"</em>` : `Nota per ${quando} — <strong>da scrivere</strong>`,
          `<a href="#/coach/comunicazioni" class="link-btn" style="font-size:12px">Scrivi la nota →</a>`)}
        ${voce(d.nPrenotati > 0, `<strong>${d.nPrenotati}</strong> ${d.nPrenotati === 1 ? "atleta ha" : "atleti hanno"} prenotato`, nomiPrenotati)}
        ${d.oggi ? voce(d.richieste.length > 0, `<strong>${d.richieste.length}</strong> richieste pre-allenamento`, richiesteHtml) : ""}
        ${riepilogoAppello(d)}`;
    })
    .catch((err) => {
      box.innerHTML = `<p class="error-text">${err instanceof ApiError ? err.message : "Errore imprevisto"}</p>`;
    });

  function riepilogoAppello(d) {
    if (!d.appelloDaChiudere) return "";
    return `
      <div style="display:flex; gap:10px; align-items:flex-start; padding:10px 0; border-top:1px solid var(--border)">
        <span style="font-size:15px; flex-shrink:0; color:var(--livello-5)">!</span>
        <div style="flex:1">
          <p style="font-size:14px">Appello di <strong>${etichettaGiorno(d.appelloDaChiudere.data)}</strong> non ancora chiuso</p>
          <p class="mono" style="font-size:12px; margin-top:2px"><a href="#/coach/presenze" class="link-btn" style="font-size:12px">Chiudi l'appello →</a></p>
        </div>
      </div>`;
  }
}

// Diario allenamenti: per ogni giorno di allenamento del mese, il focus/pattern del giorno
// + una scheda PDF/Word + foto opzionale. Ogni voce è pubblicabile nel Feed a scelta.
export function initDiario(el) {
  const meseSel = el.querySelector("#diario-mese");
  const annoInput = el.querySelector("#diario-anno");
  const focusMeseEl = el.querySelector("#diario-focus-mese");
  const calWrap = el.querySelector("#diario-calendario");
  const dettaglio = el.querySelector("#diario-dettaglio");
  const summary = el.querySelector("#diario-summary");
  const rowsWrap = el.querySelector("#diario-rows");

  const NOMI_G = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];
  const NOMI_G_UP = ["DOM", "LUN", "MAR", "MER", "GIO", "VEN", "SAB"];
  const inputStile =
    "background:var(--surface-2); border:1px solid var(--border); border-radius:6px; padding:8px 10px; color:var(--text); font:inherit";

  let giorni = [];

  const dowDi = (iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  };
  const rigaFor = (data) => rowsWrap.querySelector(`.diario-row[data-data="${data}"]`);

  function disegnaCalendario() {
    let conFocus = 0;
    calWrap.innerHTML = `
      <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(80px, 1fr)); gap:6px">
        ${giorni
          .map((g) => {
            const ha = !!(g.focus && g.focus.trim());
            if (ha) conFocus++;
            const dow = dowDi(g.data);
            const gg = Number(g.data.slice(8, 10));
            return `
              <button type="button" class="diario-cal-cell" data-data="${g.data}"
                style="display:flex; flex-direction:column; align-items:center; gap:4px; padding:8px 4px; font-size:12px;
                       border:1px solid ${ha ? "var(--livello-1)" : "var(--border)"}; border-radius:8px; cursor:pointer;
                       background:${ha ? "color-mix(in srgb, var(--livello-1) 12%, transparent)" : "var(--surface-2)"};
                       color:var(--text); font-family:inherit">
                <span>${NOMI_G[dow]} ${gg}${g.fileUrl ? " 📎" : ""}</span>
                <span style="width:8px; height:8px; border-radius:50%; background:${ha ? "var(--livello-1)" : "var(--mute)"}"></span>
              </button>`;
          })
          .join("")}
      </div>
      <p class="mono" style="color:var(--mute); font-size:11px; margin-top:6px">
        Pallino verde = focus scritto · 📎 = scheda allegata. Tocca un giorno per aprirlo.
      </p>`;

    summary.textContent = `Diario del mese — ${conFocus} su ${giorni.length} giorni con focus`;

    calWrap.querySelectorAll(".diario-cal-cell").forEach((cell) => {
      cell.addEventListener("click", () => {
        const row = rigaFor(cell.dataset.data);
        if (!row) return;
        dettaglio.open = true;
        row.scrollIntoView({ behavior: "smooth", block: "center" });
        row.style.outline = "2px solid var(--accent)";
        row.style.transition = "outline-color .3s";
        setTimeout(() => { row.style.outline = "2px solid transparent"; }, 1200);
      });
    });
  }

  function rigaDiario(g) {
    const row = document.createElement("div");
    row.className = "diario-row";
    row.dataset.data = g.data;
    row.style.cssText =
      "border:1px solid var(--border); border-radius:8px; padding:10px; display:flex; flex-direction:column; gap:8px";
    const dow = dowDi(g.data);
    const [y, m, d] = g.data.split("-").map(Number);

    row.innerHTML = `
      <p class="mono" style="font-size:12px">${NOMI_G_UP[dow]} ${d}/${m}</p>
      <textarea class="diario-focus" rows="2" placeholder="Focus / pattern del giorno — una riga per punto (es. hinge + tirata orizzontale)"
        style="${inputStile}; resize:vertical">${esc(g.focus || "")}</textarea>
      <textarea class="diario-nota" rows="2" placeholder="Nota (opzionale)"
        style="${inputStile}; resize:vertical">${esc(g.nota || "")}</textarea>

      <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap">
        <label class="link-btn" style="cursor:pointer">
          <span class="diario-file-testo">${g.fileNome ? "Cambia scheda" : "Allega scheda (PDF/Word)"}</span>
          <input class="diario-file-input" type="file" accept=".pdf,.doc,.docx" hidden />
        </label>
        <a class="diario-file-link mono" target="_blank" rel="noopener"
           style="font-size:12px; ${g.fileUrl ? "" : "display:none"}"${g.fileUrl ? ` href="${mediaUrl(g.fileUrl)}"` : ""}>📎 ${esc(g.fileNome || "")}</a>
        <button type="button" class="link-btn diario-file-rimuovi" style="color:var(--livello-5); ${g.fileUrl ? "" : "display:none"}">Rimuovi</button>
      </div>

      <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap">
        <label class="link-btn" style="cursor:pointer">
          <span class="diario-foto-testo">${g.fotoUrl ? "Cambia foto" : "Aggiungi foto"}</span>
          <input class="diario-foto-input" type="file" accept="image/*" hidden />
        </label>
        <button type="button" class="link-btn diario-foto-rimuovi" style="color:var(--livello-5); ${g.fotoUrl ? "" : "display:none"}">Rimuovi foto</button>
      </div>
      <img class="diario-foto-preview" alt="" style="max-width:100%; max-height:180px; border-radius:8px; object-fit:contain;
        align-self:flex-start; border:1px solid var(--border); display:${g.fotoUrl ? "block" : "none"}"${g.fotoUrl ? ` src="${mediaUrl(g.fotoUrl)}"` : ""} />

      <p class="error-text diario-error" hidden style="font-size:12px"></p>
      <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap">
        <button type="button" class="btn diario-salva" style="flex:1; min-width:120px">Salva giorno</button>
        <button type="button" class="link-btn diario-pubblica">${g.pubblicatoFeed ? "Pubblicato ✓ · ripubblica" : "Pubblica nel feed"}</button>
      </div>
      <div class="diario-pub-pannello" hidden style="border-top:1px solid var(--border); padding-top:8px; flex-direction:column; gap:6px">
        <p class="mono" style="font-size:12px; color:var(--mute)">Cosa pubblicare nel Feed:</p>
        <label style="font-size:13px; display:flex; gap:8px; align-items:center"><input type="checkbox" class="pub-focus" checked /> Focus del giorno</label>
        <label style="font-size:13px; display:flex; gap:8px; align-items:center"><input type="checkbox" class="pub-nota" /> Nota</label>
        <label style="font-size:13px; display:flex; gap:8px; align-items:center"><input type="checkbox" class="pub-file" /> Scheda (file scaricabile)</label>
        <label style="font-size:13px; display:flex; gap:8px; align-items:center"><input type="checkbox" class="pub-foto" /> Foto</label>
        <button type="button" class="btn diario-pub-conferma" style="margin-top:4px">Pubblica</button>
      </div>
    `;

    const focusEl = row.querySelector(".diario-focus");
    const notaEl = row.querySelector(".diario-nota");
    const errEl = row.querySelector(".diario-error");
    const fileInput = row.querySelector(".diario-file-input");
    const fileTesto = row.querySelector(".diario-file-testo");
    const fileLink = row.querySelector(".diario-file-link");
    const fileRimuovi = row.querySelector(".diario-file-rimuovi");
    const fotoInput = row.querySelector(".diario-foto-input");
    const fotoTesto = row.querySelector(".diario-foto-testo");
    const fotoRimuovi = row.querySelector(".diario-foto-rimuovi");
    const fotoPreview = row.querySelector(".diario-foto-preview");
    const salvaBtn = row.querySelector(".diario-salva");
    const pubblicaBtn = row.querySelector(".diario-pubblica");
    const pannello = row.querySelector(".diario-pub-pannello");
    const pubConferma = row.querySelector(".diario-pub-conferma");

    const mostraErrore = (msg) => { errEl.textContent = msg; errEl.hidden = false; };

    salvaBtn.addEventListener("click", async () => {
      errEl.hidden = true;
      salvaBtn.disabled = true;
      const prima = salvaBtn.textContent;
      try {
        const r = await api.post("/diario", { data: g.data, focus: focusEl.value, nota: notaEl.value });
        g.focus = r.focus;
        g.nota = r.nota;
        disegnaCalendario();
        salvaBtn.textContent = "Salvato ✓";
        setTimeout(() => { salvaBtn.textContent = prima; }, 1500);
      } catch (err) {
        mostraErrore(err instanceof ApiError ? err.message : "Errore imprevisto");
      } finally {
        salvaBtn.disabled = false;
      }
    });

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files[0];
      if (!file) return;
      errEl.hidden = true;
      try {
        const fd = new FormData();
        fd.append("data", g.data);
        fd.append("file", file);
        const r = await api.postForm("/diario/file", fd);
        g.fileUrl = r.fileUrl;
        g.fileNome = r.fileNome;
        fileLink.href = mediaUrl(r.fileUrl);
        fileLink.textContent = `📎 ${r.fileNome}`;
        fileLink.style.display = "";
        fileRimuovi.style.display = "";
        fileTesto.textContent = "Cambia scheda";
        disegnaCalendario();
      } catch (err) {
        mostraErrore(err instanceof ApiError ? err.message : "Upload non riuscito");
      } finally {
        fileInput.value = "";
      }
    });

    fileRimuovi.addEventListener("click", async () => {
      try {
        await api.del(`/diario/${g.data}/file`);
        g.fileUrl = null;
        g.fileNome = null;
        fileLink.style.display = "none";
        fileRimuovi.style.display = "none";
        fileTesto.textContent = "Allega scheda (PDF/Word)";
        disegnaCalendario();
      } catch (err) {
        mostraErrore(err instanceof ApiError ? err.message : "Errore imprevisto");
      }
    });

    fotoInput.addEventListener("change", async () => {
      const file = fotoInput.files[0];
      if (!file) return;
      errEl.hidden = true;
      try {
        const fd = new FormData();
        fd.append("data", g.data);
        fd.append("foto", file);
        const r = await api.postForm("/diario/foto", fd);
        g.fotoUrl = r.fotoUrl;
        fotoPreview.src = mediaUrl(r.fotoUrl);
        fotoPreview.style.display = "block";
        fotoRimuovi.style.display = "";
        fotoTesto.textContent = "Cambia foto";
      } catch (err) {
        mostraErrore(err instanceof ApiError ? err.message : "Upload non riuscito");
      } finally {
        fotoInput.value = "";
      }
    });

    fotoRimuovi.addEventListener("click", async () => {
      try {
        await api.del(`/diario/${g.data}/foto`);
        g.fotoUrl = null;
        fotoPreview.removeAttribute("src");
        fotoPreview.style.display = "none";
        fotoRimuovi.style.display = "none";
        fotoTesto.textContent = "Aggiungi foto";
      } catch (err) {
        mostraErrore(err instanceof ApiError ? err.message : "Errore imprevisto");
      }
    });

    pubblicaBtn.addEventListener("click", () => {
      const aperto = pannello.hidden;
      pannello.hidden = !aperto;
      pannello.style.display = aperto ? "flex" : "none";
      if (aperto) {
        const setBox = (cls, ok) => {
          const c = pannello.querySelector(cls);
          c.disabled = !ok;
          if (!ok) c.checked = false;
          c.closest("label").style.opacity = ok ? "1" : ".5";
        };
        setBox(".pub-focus", !!(g.focus && g.focus.trim()));
        setBox(".pub-nota", !!(g.nota && g.nota.trim()));
        setBox(".pub-file", !!g.fileUrl);
        setBox(".pub-foto", !!g.fotoUrl);
      }
    });

    pubConferma.addEventListener("click", async () => {
      errEl.hidden = true;
      pubConferma.disabled = true;
      try {
        await api.post(`/diario/${g.data}/pubblica`, {
          includiFocus: pannello.querySelector(".pub-focus").checked,
          includiNota: pannello.querySelector(".pub-nota").checked,
          includiFile: pannello.querySelector(".pub-file").checked,
          includiFoto: pannello.querySelector(".pub-foto").checked,
        });
        g.pubblicatoFeed = true;
        pubblicaBtn.textContent = "Pubblicato ✓ · ripubblica";
        pannello.hidden = true;
        pannello.style.display = "none";
      } catch (err) {
        mostraErrore(err instanceof ApiError ? err.message : "Errore imprevisto");
      } finally {
        pubConferma.disabled = false;
      }
    });

    return row;
  }

  async function carica() {
    calWrap.innerHTML = `<p class="mono" style="color:var(--mute); font-size:13px">Carico...</p>`;
    rowsWrap.innerHTML = "";
    let d;
    try {
      d = await api.get(`/diario?anno=${annoInput.value}&mese=${meseSel.value}`);
    } catch {
      calWrap.innerHTML = `<p class="error-text">Impossibile caricare</p>`;
      return;
    }
    giorni = d.giorni || [];
    focusMeseEl.textContent = d.focusMese ? `Focus del mese: ${d.focusMese}` : "";
    focusMeseEl.style.display = d.focusMese ? "block" : "none";

    for (const g of giorni) rowsWrap.appendChild(rigaDiario(g));
    disegnaCalendario();
  }

  meseSel.addEventListener("change", carica);
  annoInput.addEventListener("change", carica);
  carica();
}

// Storico allenamenti per il coach: per ogni giorno, chi c'era (esito appello o prenotazione)
// e il feedback post-allenamento lasciato dagli atleti. Sola lettura.
export function initRiepilogo(el) {
  const sel = el.querySelector("#riepilogo-data");
  const body = el.querySelector("#riepilogo-body");
  const FACCE = ["", "😫", "😕", "😐", "🙂", "🔥"];
  const STATO = {
    presente: { txt: "✓ presente", col: "var(--livello-1)" },
    assente: { txt: "✗ assente", col: "var(--livello-5)" },
    prenotato: { txt: "● prenotato", col: "var(--accent)" },
    indeciso: { txt: "— nessuna risposta", col: "var(--mute)" },
  };

  async function carica() {
    body.innerHTML = `<p class="mono" style="color:var(--mute); font-size:13px">Carico...</p>`;
    let d;
    try {
      d = await api.get(`/presenze/riepilogo${sel.value ? `?data=${sel.value}` : ""}`);
    } catch {
      body.innerHTML = `<p class="error-text">Impossibile caricare</p>`;
      return;
    }

    if (!sel.dataset.pop && d.giorniRecenti?.length) {
      sel.innerHTML = d.giorniRecenti
        .map((g) => `<option value="${g}">${g === oggiIso() ? "Oggi" : formatGiornoBreve(g)}</option>`)
        .join("");
      sel.value = d.data;
      sel.dataset.pop = "1";
    }

    if (!d.sessione) {
      body.innerHTML = `<p class="mono" style="color:var(--mute); font-size:13px">Nessun allenamento in questa data.</p>`;
      return;
    }

    const presenti = d.atleti.filter((a) => a.stato === "presente" || a.stato === "prenotato").length;
    const conFeedback = d.atleti.filter((a) => a.feedback).length;

    body.innerHTML = `
      <p class="mono" style="color:var(--mute); font-size:12px">
        ${presenti} present${presenti === 1 ? "e" : "i"} · ${conFeedback} feedback${d.appelloFatto ? " · appello fatto" : " · appello non ancora fatto"}
      </p>
      ${d.atleti
        .map((a) => {
          const s = STATO[a.stato] ?? STATO.indeciso;
          const fb = a.feedback
            ? `<p class="mono" style="font-size:12px; margin-top:3px">
                 ${FACCE[a.feedback.faccina] ?? ""} <span style="color:var(--mute)">${a.feedback.difficolta ?? ""}</span>${a.feedback.nota ? ` — ${esc(a.feedback.nota)}` : ""}
               </p>`
            : "";
          return `
            <div style="padding:8px 0; border-top:1px solid var(--border)">
              <p style="font-size:14px">${esc(a.nome)}
                <span class="mono" style="font-size:11px; color:${s.col}"> · ${s.txt}</span>
              </p>
              ${fb}
            </div>`;
        })
        .join("")}
    `;
  }

  sel.addEventListener("change", carica);
  carica();
}

// Giorni di chiusura / festività: tolti dal conteggio settimanale degli anelli.
export function initChiusure(el) {
  const dataInput = el.querySelector("#chiusura-data");
  const motivoInput = el.querySelector("#chiusura-motivo");
  const errorEl = el.querySelector("#chiusura-error");
  const lista = el.querySelector("#chiusura-lista");

  const fmt = (iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    const g = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    return `${["dom", "lun", "mar", "mer", "gio", "ven", "sab"][g]} ${d} ${MESI[m - 1].toLowerCase()} ${y}`;
  };

  async function carica() {
    let giorni;
    try {
      ({ giorni } = await api.get("/chiusure"));
    } catch {
      lista.innerHTML = `<p class="error-text">Impossibile caricare</p>`;
      return;
    }
    lista.innerHTML = giorni.length
      ? giorni
          .map(
            (g) => `
            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:7px 0; border-top:1px solid var(--border)">
              <span style="font-size:13px">${fmt(g.data)}${g.motivo ? ` <span class="mono" style="color:var(--mute); font-size:11px">· ${esc(g.motivo)}</span>` : ""}</span>
              <button type="button" class="link-btn chiusura-del" data-data="${g.data}" style="color:var(--livello-5); flex-shrink:0; font-size:16px; text-decoration:none">🗑</button>
            </div>`
          )
          .join("")
      : `<p class="mono" style="color:var(--mute); font-size:13px">Nessun giorno di chiusura.</p>`;

    lista.querySelectorAll(".chiusura-del").forEach((btn) => {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        try {
          await api.del(`/chiusure/${btn.dataset.data}`);
          await carica();
        } catch (err) {
          alert(err instanceof ApiError ? err.message : "Errore imprevisto");
          btn.disabled = false;
        }
      });
    });
  }

  el.querySelector("#chiusura-aggiungi").addEventListener("click", async (e) => {
    errorEl.hidden = true;
    if (!dataInput.value) {
      errorEl.textContent = "Scegli un giorno";
      errorEl.hidden = false;
      return;
    }
    e.target.disabled = true;
    try {
      await api.post("/chiusure", { data: dataInput.value, motivo: motivoInput.value.trim() || undefined });
      dataInput.value = "";
      motivoInput.value = "";
      await carica();
    } catch (err) {
      errorEl.textContent = err instanceof ApiError ? err.message : "Errore imprevisto";
      errorEl.hidden = false;
    } finally {
      e.target.disabled = false;
    }
  });

  carica();
}

export function formatGiornoBreve(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const g = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=dom
  const nomi = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];
  return `${nomi[g]} ${d}/${m}`;
}

// Appello digitale: il coach conferma chi era davvero presente all'allenamento; solo così
// scattano i 10 punti presenza. Modificabile anche per le date passate.
export function initAppello(el) {
  const sel = el.querySelector("#appello-data");
  const lista = el.querySelector("#appello-lista");
  const btn = el.querySelector("#appello-salva");
  const errorEl = el.querySelector("#appello-error");
  const successEl = el.querySelector("#appello-success");
  let sessioneId = null;

  async function carica() {
    errorEl.hidden = true;
    successEl.hidden = true;
    lista.innerHTML = `<p class="mono" style="color:var(--mute)">Carico...</p>`;

    let d;
    try {
      d = await api.get(`/presenze/appello${sel.value ? `?data=${sel.value}` : ""}`);
    } catch (err) {
      lista.innerHTML = `<p class="error-text">${err instanceof ApiError ? err.message : "Errore imprevisto"}</p>`;
      return;
    }

    if (!sel.dataset.pop && d.giorniRecenti?.length) {
      sel.innerHTML = d.giorniRecenti
        .map((g) => `<option value="${g}">${g === oggiIso() ? "Oggi" : formatGiornoBreve(g)}</option>`)
        .join("");
      sel.value = d.data;
      sel.dataset.pop = "1";
    }

    if (!d.sessione) {
      sessioneId = null;
      btn.hidden = true;
      lista.innerHTML = `<p class="mono" style="color:var(--mute); font-size:13px">Nessun allenamento in questa data.</p>`;
      return;
    }

    sessioneId = d.sessione.id;
    btn.hidden = false;
    btn.textContent = d.confermato ? "Aggiorna appello" : "Conferma appello";

    lista.innerHTML = d.atleti.length
      ? d.atleti
          .map((a) => {
            const nome = [a.nome, a.cognome].filter(Boolean).join(" ") || a.nickname || a.nome;
            const spuntato = a.confermata || a.richiesta ? "checked" : "";
            const tag = a.richiesta
              ? `<span class="mono" style="color:var(--accent); font-size:11px; white-space:nowrap">ha prenotato</span>`
              : "";
            return `
              <label style="display:flex; align-items:center; gap:10px; padding:9px 0; border-top:1px solid var(--border)">
                <input type="checkbox" class="appello-check" data-user-id="${a.userId}" ${spuntato} />
                <span style="flex:1; font-size:14px">${nome}</span>${tag}
              </label>`;
          })
          .join("")
      : `<p class="mono" style="color:var(--mute); font-size:13px">Nessun atleta.</p>`;
  }

  sel.addEventListener("change", carica);

  btn.addEventListener("click", async () => {
    if (!sessioneId) return;
    errorEl.hidden = true;
    successEl.hidden = true;
    const presentiUserIds = [...lista.querySelectorAll(".appello-check:checked")].map((c) => Number(c.dataset.userId));
    btn.disabled = true;
    try {
      await api.post("/presenze/appello", { data: sel.value, sessioneId, presentiUserIds });
      successEl.hidden = false;
      await carica();
    } catch (err) {
      errorEl.textContent = err instanceof ApiError ? err.message : "Errore imprevisto";
      errorEl.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });

  carica();
}

export function initNota(el) {
  const dataInput = el.querySelector("#nota-data");
  const status = el.querySelector("#nota-status");
  const testo = el.querySelector("#nota-testo");
  const errorEl = el.querySelector("#nota-error");
  const successEl = el.querySelector("#nota-success");

  function carica() {
    testo.value = "";
    const oggi = dataInput.value === oggiIso();
    api
      .get(`/nota-coach?data=${dataInput.value}`)
      .then((r) => {
        status.innerHTML = r.testo
          ? `<p class="mono" style="color:var(--mute); font-size:13px">Nota attuale: “${r.testo}”</p>`
          : `<p class="mono" style="color:var(--mute); font-size:13px">Nessuna nota per ${oggi ? "oggi" : "questa data"}.</p>`;
        if (r.testo) testo.value = r.testo;
      })
      .catch(() => {
        status.innerHTML = "";
      });
  }

  dataInput.addEventListener("change", carica);

  el.querySelector("#nota-salva").addEventListener("click", async (e) => {
    errorEl.hidden = true;
    successEl.hidden = true;
    if (!testo.value.trim()) {
      errorEl.textContent = "Scrivi un testo";
      errorEl.hidden = false;
      return;
    }
    e.target.disabled = true;
    try {
      await api.post("/nota-coach", { testo: testo.value.trim(), data: dataInput.value });
      successEl.hidden = false;
      carica();
    } catch (err) {
      errorEl.textContent = err instanceof ApiError ? err.message : "Errore imprevisto";
      errorEl.hidden = false;
    } finally {
      e.target.disabled = false;
    }
  });

  carica();
}

export function initAnnuncio(el) {
  const testo = el.querySelector("#annuncio-testo");
  const errorEl = el.querySelector("#annuncio-error");
  const successEl = el.querySelector("#annuncio-success");

  el.querySelector("#annuncio-pub").addEventListener("click", async (e) => {
    errorEl.hidden = true;
    successEl.hidden = true;
    if (!testo.value.trim()) {
      errorEl.textContent = "Scrivi un testo";
      errorEl.hidden = false;
      return;
    }
    e.target.disabled = true;
    try {
      await api.post("/feed/annuncio", { testo: testo.value.trim() });
      successEl.hidden = false;
      testo.value = "";
    } catch (err) {
      errorEl.textContent = err instanceof ApiError ? err.message : "Errore imprevisto";
      errorEl.hidden = false;
    } finally {
      e.target.disabled = false;
    }
  });
}

export function rigaMerenda(m = {}, onChange = () => {}) {
  const row = document.createElement("div");
  row.className = "merenda-row";
  row.style.cssText = "border:1px solid var(--border); border-radius:8px; padding:10px; display:flex; flex-direction:column; gap:8px";
  row.dataset.fotoUrl = m.fotoUrl ?? "";
  const inputStile = "background:var(--surface-2); border:1px solid var(--border); border-radius:6px; padding:8px 10px; color:var(--text)";
  row.innerHTML = `
    <input class="merenda-titolo" type="text" placeholder="Titolo (opzionale)" value="${m.titolo ?? ""}" style="${inputStile}" />
    <textarea class="merenda-descrizione" rows="3" placeholder="Descrizione — vai a capo per fare un elenco (una riga = un punto)" style="${inputStile}; resize:vertical; font:inherit">${m.descrizione ?? ""}</textarea>
    <input class="merenda-link" type="text" placeholder="Link video ricetta Instagram (opzionale)" value="${m.linkUrl ?? ""}" style="${inputStile}" />

    <div style="display:flex; flex-direction:column; gap:8px">
      <img class="merenda-foto-preview" alt="Anteprima grafica" style="max-width:100%; width:auto; max-height:200px; border-radius:8px; object-fit:contain; align-self:flex-start; border:1px solid var(--border); display:${m.fotoUrl ? "block" : "none"}"${m.fotoUrl ? ` src="${mediaUrl(m.fotoUrl)}"` : ""} />
      <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap">
        <label class="link-btn" style="cursor:pointer">
          <span class="merenda-foto-testo">${m.fotoUrl ? "Cambia grafica" : "Aggiungi grafica"}</span>
          <input class="merenda-foto-input" type="file" accept="image/*" hidden />
        </label>
        <button type="button" class="link-btn merenda-foto-rimuovi" style="color:var(--livello-5); display:${m.fotoUrl ? "inline" : "none"}">Rimuovi</button>
      </div>
      <p class="error-text merenda-foto-error" hidden style="font-size:12px"></p>
    </div>

    <div style="display:flex; align-items:center; gap:8px">
      <label class="mono" style="font-size:12px; color:var(--mute)">Per il giorno</label>
      <input class="merenda-data" type="date" value="${m.data ?? ""}" style="${inputStile}" />
    </div>
    <button type="button" class="link-btn merenda-rimuovi" style="align-self:flex-start; color:var(--livello-5)">Rimuovi</button>
  `;

  const preview = row.querySelector(".merenda-foto-preview");
  const testo = row.querySelector(".merenda-foto-testo");
  const fileInput = row.querySelector(".merenda-foto-input");
  const rimuoviFoto = row.querySelector(".merenda-foto-rimuovi");
  const fotoError = row.querySelector(".merenda-foto-error");

  function mostraFoto(url) {
    row.dataset.fotoUrl = url || "";
    if (url) {
      preview.src = mediaUrl(url);
      preview.style.display = "block";
    } else {
      preview.removeAttribute("src");
      preview.style.display = "none";
    }
    rimuoviFoto.style.display = url ? "inline" : "none";
    testo.textContent = url ? "Cambia grafica" : "Aggiungi grafica";
  }

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;
    fotoError.hidden = true;
    try {
      const fd = new FormData();
      fd.append("foto", file);
      const res = await api.postForm("/programma/merenda-foto", fd);
      mostraFoto(res.fotoUrl);
    } catch (err) {
      fotoError.textContent = err instanceof ApiError ? err.message : "Upload non riuscito";
      fotoError.hidden = false;
    } finally {
      fileInput.value = "";
    }
  });

  rimuoviFoto.addEventListener("click", () => mostraFoto(""));
  row.querySelector(".merenda-rimuovi").addEventListener("click", () => {
    row.remove();
    onChange();
  });
  row.querySelector(".merenda-data").addEventListener("change", () => onChange());
  return row;
}

export function initPiano(el) {
  const meseSel = el.querySelector("#piano-mese");
  const annoInput = el.querySelector("#piano-anno");
  const campi = {
    focusTema: el.querySelector("#piano-focus"),
    obiettivo: el.querySelector("#piano-obiettivo"),
    percheMese: el.querySelector("#piano-perche"),
    risultatoAtteso: el.querySelector("#piano-risultato"),
    focusNutrizionale: el.querySelector("#piano-focus-nutri"),
    lineeGuidaNutrizionali: el.querySelector("#piano-linee"),
    obiettivoNutrizionale: el.querySelector("#piano-obiettivo-nutri"),
  };
  const merendeRows = el.querySelector("#merende-rows");
  const calWrap = el.querySelector("#merende-calendario");
  const dettaglioMerende = el.querySelector("#merende-dettaglio");
  const summaryMerende = el.querySelector("#merende-summary");
  const errorEl = el.querySelector("#piano-error");
  const successEl = el.querySelector("#piano-success");

  // Calendario merende: solo i giorni di allenamento (lun/mer/ven) del mese selezionato,
  // perché le merende esistono solo in quei giorni. Serve alla coach per vedere a colpo
  // d'occhio quali L/M/V sono ancora senza merenda.
  const NOMI_G = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];
  function giorniLMV(anno, mese) {
    const out = [];
    const ultimo = new Date(Date.UTC(anno, mese, 0)).getUTCDate();
    for (let d = 1; d <= ultimo; d++) {
      const dow = new Date(Date.UTC(anno, mese - 1, d)).getUTCDay();
      if (dow === 1 || dow === 3 || dow === 5) {
        out.push({ iso: `${anno}-${String(mese).padStart(2, "0")}-${String(d).padStart(2, "0")}`, label: `${NOMI_G[dow]} ${d}` });
      }
    }
    return out;
  }
  function merendePerData() {
    const m = new Map();
    for (const row of merendeRows.querySelectorAll(".merenda-row")) {
      const iso = row.querySelector(".merenda-data").value;
      if (iso && !m.has(iso)) m.set(iso, row);
    }
    return m;
  }
  function disegnaCalendarioMerende() {
    const anno = Number(annoInput.value);
    const mese = Number(meseSel.value);
    const giorni = giorniLMV(anno, mese);
    const mappa = merendePerData();
    let assegnate = 0;

    calWrap.innerHTML = `
      <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(78px, 1fr)); gap:6px">
        ${giorni
          .map((g) => {
            const ha = mappa.has(g.iso);
            if (ha) assegnate++;
            return `
              <button type="button" class="merenda-cal-cell" data-iso="${g.iso}"
                style="display:flex; flex-direction:column; align-items:center; gap:4px; padding:8px 4px; font-size:12px;
                       border:1px solid ${ha ? "var(--livello-1)" : "var(--border)"}; border-radius:8px; cursor:pointer;
                       background:${ha ? "color-mix(in srgb, var(--livello-1) 12%, transparent)" : "var(--surface-2)"};
                       color:var(--text); font-family:inherit">
                <span>${g.label}</span>
                <span style="width:8px; height:8px; border-radius:50%; background:${ha ? "var(--livello-1)" : "var(--mute)"}"></span>
              </button>`;
          })
          .join("")}
      </div>
      <p class="mono" style="color:var(--mute); font-size:11px; margin-top:6px">
        Pallino verde = merenda pronta. Tocca un giorno per aggiungerla o modificarla.
      </p>`;

    summaryMerende.textContent = `Merende del mese — ${assegnate} su ${giorni.length} giorni`;

    calWrap.querySelectorAll(".merenda-cal-cell").forEach((cell) => {
      cell.addEventListener("click", () => {
        const iso = cell.dataset.iso;
        let row = merendePerData().get(iso);
        if (!row) {
          row = rigaMerenda({ data: iso }, disegnaCalendarioMerende);
          merendeRows.appendChild(row);
          disegnaCalendarioMerende();
        }
        dettaglioMerende.open = true;
        row.scrollIntoView({ behavior: "smooth", block: "center" });
        row.style.outline = "2px solid var(--accent)";
        row.style.transition = "outline-color .3s";
        setTimeout(() => { row.style.outline = "2px solid transparent"; }, 1200);
      });
    });
  }

  // Vero solo quando le merende del mese corrente sono state caricate con successo (o è un
  // mese nuovo senza merende). Se il caricamento fallisce restiamo a false e il salvataggio
  // NON invia il campo `merende` → il worker lascia intatte quelle già salvate.
  let merendeSincronizzate = false;
  let primoCarica = true;
  const nota = el.querySelector("#merende-mese-nota");

  async function carica() {
    errorEl.hidden = true;
    successEl.hidden = true;
    for (const input of Object.values(campi)) input.value = "";
    merendeRows.innerHTML = "";
    merendeSincronizzate = false;

    let mese = Number(meseSel.value);
    let anno = Number(annoInput.value);
    try {
      const { mesi } = await api.get("/programma");

      // Al primo caricamento, se il mese di default (mese di calendario) è PRIMA dell'inizio
      // della stagione, spostati sul primo mese disponibile. Senza questo, ad agosto la
      // tendina parte da "Agosto" e il coach rischia di salvare contenuti/merende su un mese
      // che non compare nel Programma (fuori stagione) — è successo davvero.
      if (primoCarica && mesi.length) {
        const chiave = (m) => m.anno * 100 + m.mese;
        if (chiave({ mese, anno }) < chiave(mesi[0])) {
          mese = mesi[0].mese;
          anno = mesi[0].anno;
          meseSel.value = String(mese);
          annoInput.value = String(anno);
        }
      }
      primoCarica = false;
      if (nota) {
        nota.textContent =
          `Stai modificando ${MESI[mese - 1]} ${anno}. Le merende finiscono in questo mese; ` +
          `la data "Per il giorno" dice solo agli atleti quando vale, non le sposta.`;
      }

      const esistente = mesi.find((m) => m.mese === mese && m.anno === anno);
      if (!esistente) {
        merendeSincronizzate = true; // mese nuovo: nessuna merenda, form vuoto di proposito
      } else {
        const dettaglio = await api.get(`/programma/${esistente.id}`);
        for (const [chiave, input] of Object.entries(campi)) input.value = dettaglio[chiave] ?? "";
        for (const m of dettaglio.merende ?? []) merendeRows.appendChild(rigaMerenda(m, disegnaCalendarioMerende));
        merendeSincronizzate = true;
      }
    } catch {
      // Errore di rete: non sappiamo lo stato reale delle merende — non toccarle al salvataggio.
    }
    disegnaCalendarioMerende();
  }

  meseSel.addEventListener("change", carica);
  annoInput.addEventListener("change", carica);
  el.querySelector("#merenda-aggiungi").addEventListener("click", () => {
    merendeRows.appendChild(rigaMerenda({}, disegnaCalendarioMerende));
    disegnaCalendarioMerende();
  });

  el.querySelector("#piano-salva").addEventListener("click", async (e) => {
    errorEl.hidden = true;
    successEl.hidden = true;

    const merende = [...merendeRows.querySelectorAll(".merenda-row")]
      .map((row) => ({
        titolo: row.querySelector(".merenda-titolo").value.trim() || undefined,
        descrizione: row.querySelector(".merenda-descrizione").value.trim() || undefined,
        linkUrl: row.querySelector(".merenda-link").value.trim() || undefined,
        data: row.querySelector(".merenda-data").value || undefined,
        fotoUrl: row.dataset.fotoUrl || undefined,
      }))
      .filter((m) => m.titolo || m.descrizione || m.linkUrl || m.fotoUrl);

    e.target.disabled = true;
    try {
      const payload = { mese: Number(meseSel.value), anno: Number(annoInput.value) };
      if (merendeSincronizzate) payload.merende = merende;
      for (const [chiave, input] of Object.entries(campi)) {
        payload[chiave] = input.value.trim() || undefined;
      }
      await api.post("/programma", payload);
      successEl.hidden = false;
    } catch (err) {
      errorEl.textContent = err instanceof ApiError ? err.message : "Errore imprevisto";
      errorEl.hidden = false;
    } finally {
      e.target.disabled = false;
    }
  });

  carica();
}

export function initSfida(el) {
  const errorEl = el.querySelector("#sfida-error");
  const successEl = el.querySelector("#sfida-success");
  const tipoSel = el.querySelector("#sfida-tipo");
  const criterioWrap = el.querySelector("#sfida-criterio-wrap");
  const criterioSel = el.querySelector("#sfida-criterio");
  const criterioN = el.querySelector("#sfida-criterio-n");
  const flashChk = el.querySelector("#sfida-flash");
  const meseSel = el.querySelector("#sfida-mese");
  const annoInput = el.querySelector("#sfida-anno");
  const datePrecise = el.querySelector("#sfida-date-precise");
  const inizioInput = el.querySelector("#sfida-inizio");
  const fineInput = el.querySelector("#sfida-fine");
  const elenco = el.querySelector("#sfide-elenco");

  let sfideCache = [];

  // ─── A. Elenco ───────────────────────────────────────────────────────────
  async function carica() {
    try {
      const { sfide } = await api.get("/sfide");
      sfideCache = sfide;
    } catch {
      elenco.innerHTML = `<p class="error-text">Impossibile caricare le sfide</p>`;
      return;
    }

    if (!sfideCache.length) {
      elenco.innerHTML = `<p class="mono" style="color:var(--mute); font-size:13px">Ancora nessuna sfida.</p>`;
    } else {
      const perMese = new Map();
      for (const s of sfideCache) {
        const k = (s.data_inizio || "").slice(0, 7);
        if (!perMese.has(k)) perMese.set(k, []);
        perMese.get(k).push(s);
      }
      const mesi = [...perMese.keys()].sort().reverse();
      elenco.innerHTML = mesi
        .map((k) => {
          const [anno, mm] = k.split("-");
          const righe = perMese
            .get(k)
            .sort((a, b) => (a.data_fine < b.data_fine ? 1 : -1))
            .map((s) => {
              const dd = (iso) => iso.slice(8, 10) + "/" + iso.slice(5, 7);
              const flashBadge = s.flash
                ? ` <span class="mono" style="color:var(--sessione-b); font-size:10px">⚡ LAMPO</span>`
                : "";
              return `
                <div style="display:flex; align-items:flex-start; gap:8px; padding:8px 0; border-top:1px solid var(--border)">
                  <div style="flex:1; min-width:0">
                    <p style="font-size:14px; font-weight:600">${esc(s.titolo)}${flashBadge}</p>
                    <p class="mono" style="color:var(--mute); font-size:11px; margin-top:2px">
                      ${descriviSfida(s)} · ${dd(s.data_inizio)}–${dd(s.data_fine)} · ${s.numeroPartecipanti} partecipanti
                    </p>
                  </div>
                  <button type="button" class="link-btn sfida-del" data-id="${s.id}"
                    style="color:var(--livello-5); flex-shrink:0; text-decoration:none; font-size:16px">🗑</button>
                </div>`;
            })
            .join("");
          return `
            <p class="mono" style="color:var(--mute); font-size:11px; letter-spacing:1px; margin:12px 0 0">
              ${(MESI[+mm - 1] || "").toUpperCase()} ${anno}
            </p>
            ${righe}`;
        })
        .join("");

      elenco.querySelectorAll(".sfida-del").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const s = sfideCache.find((x) => String(x.id) === btn.dataset.id);
          if (!s) return;
          const n = Number(s.numeroPartecipanti) || 0;
          const avviso = n > 0 ? ` Toglierai ~${n * 10} punti a ${n} atlet${n === 1 ? "a" : "i"}.` : "";
          if (!confirm(`Eliminare «${s.titolo}»?${avviso}`)) return;
          btn.disabled = true;
          try {
            await api.del(`/sfide/${s.id}`);
            await carica();
          } catch (err) {
            alert(err instanceof ApiError ? err.message : "Errore imprevisto");
            btn.disabled = false;
          }
        });
      });
    }
  }

  // ─── B. Form nuova sfida ─────────────────────────────────────────────────
  const aggiornaCriterio = () => {
    // `.field` ha display:flex, che vince su [hidden] -> uso style.display.
    criterioWrap.style.display = tipoSel.value === "traguardo" ? "" : "none";
    criterioN.hidden = !(tipoSel.value === "traguardo" && criterioSel.value === "presenze");
  };
  tipoSel.addEventListener("change", aggiornaCriterio);
  criterioSel.addEventListener("change", aggiornaCriterio);
  aggiornaCriterio();

  // Spuntando "sfida lampo" apro le date precise e propongo i prossimi 7 giorni.
  flashChk.addEventListener("change", () => {
    if (flashChk.checked) {
      datePrecise.open = true;
      if (!inizioInput.value && !fineInput.value) {
        const d = new Date();
        const fine = new Date(d.getTime() + 7 * 86400000);
        inizioInput.value = d.toISOString().slice(0, 10);
        fineInput.value = fine.toISOString().slice(0, 10);
      }
    }
  });

  // Periodo della sfida: date precise se sono state compilate entrambe (per le lampo),
  // altrimenti tutto il mese scelto nella tendina.
  function periodoSfida() {
    if (inizioInput.value && fineInput.value) {
      return { inizio: inizioInput.value, fine: fineInput.value };
    }
    return estremiMese(Number(annoInput.value), Number(meseSel.value));
  }

  el.querySelector("#sfida-crea").addEventListener("click", async (e) => {
    errorEl.hidden = true;
    successEl.hidden = true;

    const titolo = el.querySelector("#sfida-titolo").value.trim();
    const descrizione = el.querySelector("#sfida-descrizione").value.trim();
    const tipo = tipoSel.value;
    const { inizio: dataInizio, fine: dataFine } = periodoSfida();
    let criterio;
    if (tipo === "traguardo") {
      criterio = criterioSel.value === "presenze" ? `presenze:${Number(criterioN.value) || 1}` : criterioSel.value;
    }

    if (!titolo || !dataInizio || !dataFine) {
      errorEl.textContent = "Titolo e mese della sfida sono obbligatori";
      errorEl.hidden = false;
      return;
    }
    if (dataFine < dataInizio) {
      errorEl.textContent = "La data di fine è prima di quella di inizio";
      errorEl.hidden = false;
      return;
    }

    e.target.disabled = true;
    try {
      await api.post("/sfide", {
        titolo,
        descrizione: descrizione || undefined,
        tipo,
        criterio,
        flash: flashChk.checked ? 1 : 0,
        data_inizio: dataInizio,
        data_fine: dataFine,
      });
      successEl.hidden = false;
      el.querySelector("#sfida-titolo").value = "";
      el.querySelector("#sfida-descrizione").value = "";
      flashChk.checked = false;
      inizioInput.value = "";
      fineInput.value = "";
      datePrecise.open = false;
      await carica();
    } catch (err) {
      errorEl.textContent = err instanceof ApiError ? err.message : "Errore imprevisto";
      errorEl.hidden = false;
    } finally {
      e.target.disabled = false;
    }
  });

  carica();
}

export function initSuddivisioni(el) {
  const meseSel = el.querySelector("#sudd-mese");
  const annoInput = el.querySelector("#sudd-anno");
  const body = el.querySelector("#sudd-body");
  const eur = (n) => (Number.isInteger(n) ? `${n} €` : `${n.toFixed(2)} €`);

  async function carica() {
    body.innerHTML = `<p class="mono" style="color:var(--mute); font-size:13px">Carico...</p>`;
    let d;
    try {
      d = await api.get(`/suddivisioni?anno=${annoInput.value}&mese=${meseSel.value}`);
    } catch {
      body.innerHTML = `<p class="error-text">Impossibile caricare</p>`;
      return;
    }

    // Tabella piatta: tutti gli atleti con un abbonamento, in ordine di nome. Colonne:
    // nome · abbonamento · quota a te · quota palestra. Chi non ha pagato è in grigio.
    const intestazione = `
      <div style="display:grid; grid-template-columns:1fr auto auto; gap:8px; padding:6px 0; border-bottom:1px solid var(--border)">
        <span class="mono" style="font-size:10px; letter-spacing:1px; color:var(--mute)">NOME · ABBONAMENTO</span>
        <span class="mono" style="font-size:10px; letter-spacing:1px; color:var(--mute); text-align:right">A TE</span>
        <span class="mono" style="font-size:10px; letter-spacing:1px; color:var(--mute); text-align:right">PALESTRA</span>
      </div>`;
    const righe = d.righe.length
      ? intestazione +
        d.righe
          .map((r) => {
            const celleQuote =
              r.piano == null
                ? `<span class="mono" style="font-size:11px; text-align:right; color:var(--livello-5); grid-column:2 / 4">abbonamento da assegnare</span>`
                : r.quotaCoach != null
                  ? `<span class="mono" style="font-size:12px; text-align:right; color:var(--livello-1)">${eur(r.quotaCoach)}</span>
                     <span class="mono" style="font-size:12px; text-align:right; color:var(--mute)">${eur(r.quotaPalestra)}</span>`
                  : `<span class="mono" style="font-size:11px; text-align:right; color:var(--livello-5); grid-column:2 / 4">% da definire</span>`;
            return `
              <div style="display:grid; grid-template-columns:1fr auto auto; gap:8px; align-items:baseline; padding:7px 0; border-top:1px solid var(--border); opacity:${r.pagato ? 1 : 0.5}">
                <span style="font-size:13px; min-width:0">${esc(r.nome)}
                  <span class="mono" style="color:var(--mute); font-size:11px"> · ${r.nomePiano ?? r.piano}${r.pagato ? "" : " · da pagare"}</span>
                </span>
                ${celleQuote}
              </div>`;
          })
          .join("")
      : `<p class="mono" style="color:var(--mute); font-size:13px">Nessun atleta con abbonamento questo mese.</p>`;

    const t = d.totali;
    const totali = `
      <div style="margin-top:12px; padding-top:10px; border-top:2px solid var(--border)">
        <div style="display:flex; justify-content:space-between; font-size:13px"><span>Totale a te</span><strong style="color:var(--livello-1)">${eur(t.coach)}</strong></div>
        <div style="display:flex; justify-content:space-between; font-size:13px; margin-top:4px"><span>Totale a Cosimo</span><strong>${eur(t.palestra)}</strong></div>
        ${t.daDefinire ? `<div style="display:flex; justify-content:space-between; font-size:13px; margin-top:4px; color:var(--livello-5)"><span>Da definire</span><strong>${eur(t.daDefinire)}</strong></div>` : ""}
      </div>
      <p class="mono" style="color:var(--mute); font-size:11px; margin-top:6px">I totali contano solo chi ha pagato.</p>
      ${t.senzaPiano ? `<p class="mono" style="color:var(--livello-5); font-size:11px; margin-top:4px">${t.senzaPiano} ${t.senzaPiano === 1 ? "ha pagato ma non ha" : "hanno pagato ma non hanno"} un abbonamento assegnato — impostalo dalla scheda dell'atleta o nella spunta pagamenti.</p>` : ""}
      <button type="button" class="btn" id="sudd-pdf" style="width:100%; margin-top:10px; background:var(--surface-2); color:var(--text)">Scarica PDF</button>`;

    const config = `
      <div style="margin-top:14px; padding-top:10px; border-top:1px solid var(--border)">
        <p class="mono" style="color:var(--mute); font-size:11px; letter-spacing:1px">PROMEMORIA · % CHE SPETTA A TE PER ABBONAMENTO</p>
        ${PIANI.map((pl) => {
          const val = d.config[pl.key];
          return `
            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top:8px">
              <span class="mono" style="font-size:12px; color:${pl.colore}">${pl.nome} <span style="color:var(--mute)">· ${pl.prezzo} €</span></span>
              <span style="display:flex; align-items:center; gap:4px">
                <input type="number" class="sudd-pct" data-piano="${pl.key}" min="0" max="100" value="${val ?? ""}" placeholder="—"
                  style="width:64px; text-align:right; background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:6px 8px; color:var(--text); font-family:inherit" />
                <span class="mono" style="color:var(--mute); font-size:12px">%</span>
              </span>
            </div>`;
        }).join("")}
      </div>`;

    body.innerHTML = righe + totali + config;

    const pdfBtn = body.querySelector("#sudd-pdf");
    if (pdfBtn) {
      pdfBtn.addEventListener("click", async () => {
        pdfBtn.disabled = true;
        pdfBtn.textContent = "Preparo il PDF…";
        try {
          const { scaricaSuddivisioniPdf } = await import("../pdf/suddivisioni-pdf.js");
          await scaricaSuddivisioniPdf(d, MESI, PIANI);
        } catch {
          alert("Non sono riuscito a generare il PDF.");
        } finally {
          pdfBtn.disabled = false;
          pdfBtn.textContent = "Scarica PDF";
        }
      });
    }

    body.querySelectorAll(".sudd-pct").forEach((inp) => {
      inp.addEventListener("change", async () => {
        const v = inp.value.trim();
        if (v === "" || Number(v) < 0 || Number(v) > 100) return;
        inp.disabled = true;
        try {
          await api.post("/suddivisioni/config", { piano: inp.dataset.piano, quotaCoachPct: Number(v) });
          await carica();
        } catch {
          inp.disabled = false;
        }
      });
    });
  }

  meseSel.addEventListener("change", carica);
  annoInput.addEventListener("change", carica);
  carica();
}

export function initRichieste(el) {
  const list = el.querySelector("#richieste-list");

  async function carica() {
    list.innerHTML = `<p class="mono" style="color:var(--mute)">Carico...</p>`;
    try {
      const { richieste, conteggi } = await api.get("/richieste/oggi/coach");

      if (!richieste.length) {
        list.innerHTML = `<p class="mono" style="color:var(--mute); font-size:13px">Nessuna richiesta per oggi.</p>`;
        return;
      }

      const conteggiHtml = conteggi && conteggi.length
        ? `<p class="mono" style="font-size:13px; line-height:1.8; padding-bottom:8px">
             ${conteggi.map((x) => `${etichettaCategoria(x.categoria)}&nbsp;<strong>${x.n}</strong>`).join(" · ")}
           </p>`
        : "";

      list.innerHTML =
        conteggiHtml +
        richieste
          .map(
            (r) => `
            <div style="border-top:1px solid var(--border); padding:8px 0">
              <p style="font-size:14px"><strong>${r.nickname || r.nome}</strong></p>
              ${r.categoria ? `<p class="mono" style="color:var(--accent); font-size:13px; margin-top:2px">${etichettaCategoria(r.categoria)}</p>` : ""}
              ${r.testoLibero ? `<p style="font-size:13px; margin-top:2px">${r.testoLibero}</p>` : ""}
            </div>
          `
          )
          .join("");
    } catch (err) {
      list.innerHTML = `<p class="error-text">${err instanceof ApiError ? err.message : "Errore imprevisto"}</p>`;
    }
  }

  el.querySelector("#richieste-refresh").addEventListener("click", carica);
  carica();
}
