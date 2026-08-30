import { renderTabbar } from "../components/tabbar.js";
import { api, ApiError, mediaUrl } from "../api.js";

// Solo http/https: evita che un link_url malformato (es. "javascript:...") diventi un href eseguibile.
function linkSicuro(url) {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

const MESI = [
  "Gen", "Feb", "Mar", "Apr", "Mag", "Giu",
  "Lug", "Ago", "Set", "Ott", "Nov", "Dic",
];

const GIORNI_SETTIMANA = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

// "2026-08-25" -> "Lunedì 25/08" — un'etichetta leggibile per la data assegnata a una merenda.
function etichettaData(dataIso) {
  const d = new Date(`${dataIso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  const giorno = GIORNI_SETTIMANA[d.getUTCDay()];
  const gg = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${giorno} ${gg}/${mm}`;
}

// Domenica 23:59:59 (ora locale ≈ Roma) della settimana Lun–Dom che contiene `d`.
function fineSettimana(d) {
  const dowLun = (d.getDay() + 6) % 7; // 0 = lunedì
  const domenica = new Date(d);
  domenica.setDate(d.getDate() + (6 - dowLun));
  domenica.setHours(23, 59, 59, 999);
  return domenica;
}

// Una merenda con data compare all'atleta dalle 07:00 (ora locale ≈ Roma) del suo
// giorno e resta visibile fino a fine settimana: lunedì si vede quella di lunedì,
// mercoledì quelle di lun+mer, venerdì tutte e tre; la settimana dopo riparte da capo.
// Le merende senza data sono sempre visibili.
function merendaDisponibile(dataIso, ora = new Date()) {
  if (!dataIso) return true;
  const giorno = new Date(`${dataIso}T00:00:00`);
  if (Number.isNaN(giorno.getTime())) return true;
  const disponibileDa = new Date(giorno);
  disponibileDa.setHours(7, 0, 0, 0);
  return ora >= disponibileDa && ora <= fineSettimana(giorno);
}

// Testo multi-paragrafo (righe vuote = separatore) -> <p> uno per capoverso.
function paragrafi(testo, marginTop = "10px") {
  return String(testo)
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p, i) => `<p style="margin-top:${i === 0 ? marginTop : "10px"}">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

// Elenco puntato: una riga per punto, con o senza bullet iniziale (*, -, •).
function puntiElenco(testo) {
  const voci = String(testo)
    .split("\n")
    .map((r) => r.replace(/^\s*[*\-•]\s*/, "").trim())
    .filter(Boolean);
  if (!voci.length) return "";
  return `<ul style="margin:10px 0 0; padding-left:18px; font-size:14px; line-height:1.6">
    ${voci.map((v) => `<li style="margin-top:4px">${v}</li>`).join("")}
  </ul>`;
}

// Blocco a tendina (chiuso di default) per la pagina Programma. Niente blocco se il corpo è vuoto.
function bloccoTendina(titolo, corpoHtml) {
  if (!corpoHtml) return "";
  return `
    <details class="blocco-mese">
      <summary>${titolo}</summary>
      <div class="blocco-corpo">${corpoHtml}</div>
    </details>
  `;
}

export function renderProgramma(appEl) {
  const el = document.createElement("div");
  el.className = "screen";
  el.innerHTML = `
    <h1>Programma</h1>
    <div id="mesi-tabs" style="display:flex; gap:8px; overflow-x:auto; padding:12px 0"></div>
    <p class="mono" style="color:var(--mute); font-size:12px">
      I mesi futuri si sbloccano quando arrivano — niente spoiler sul programma 😉
    </p>
    <div id="mese-content" style="margin-top:16px"></div>
  `;
  appEl.appendChild(el);
  appEl.appendChild(renderTabbar());

  loadMesi(el);
}

async function loadMesi(el) {
  const tabs = el.querySelector("#mesi-tabs");
  const content = el.querySelector("#mese-content");

  try {
    const { mesi } = await api.get("/programma");

    if (!mesi.length) {
      tabs.remove();
      content.innerHTML = `<p class="mono" style="color:var(--mute)">Nessun programma pubblicato ancora.</p>`;
      return;
    }

    // Default: l'ultimo mese sbloccato (il più recente disponibile).
    const sbloccati = mesi.filter((m) => m.sbloccato);
    let selezionato = (sbloccati.at(-1) ?? mesi[0]).id;

    tabs.innerHTML = mesi
      .map(
        (m) => `
          <button type="button" class="mese-tab" data-id="${m.id}"
            style="flex:0 0 auto; min-width:56px; padding:10px 6px; border-radius:8px; border:1px solid var(--border);
                   background:${m.id === selezionato ? "var(--surface-2)" : "transparent"}; color:var(--text)">
            <div class="mono" style="font-size:12px">${MESI[m.mese - 1]}</div>
            <div style="margin-top:4px">${m.sbloccato ? (m.id === selezionato ? "●" : "") : `<img src="/lucchetto.png" alt="Bloccato" style="width:12px; height:12px" />`}</div>
          </button>
        `
      )
      .join("");

    const selezionaTab = (id) => {
      selezionato = id;
      tabs.querySelectorAll(".mese-tab").forEach((btn) => {
        const attivo = Number(btn.dataset.id) === id;
        btn.style.background = attivo ? "var(--surface-2)" : "transparent";
        const dot = btn.querySelector("div:last-child");
        const mese = mesi.find((m) => m.id === Number(btn.dataset.id));
        dot.innerHTML = mese.sbloccato ? (attivo ? "●" : "") : `<img src="/lucchetto.png" alt="Bloccato" style="width:12px; height:12px" />`;
      });
    };

    tabs.querySelectorAll(".mese-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.dataset.id);
        const mese = mesi.find((m) => m.id === id);
        if (!mese.sbloccato) return;
        selezionaTab(id);
        loadDettaglio(content, id);
      });
    });

    loadDettaglio(content, selezionato);
  } catch (err) {
    tabs.remove();
    content.innerHTML = `<p class="error-text">${err instanceof ApiError ? err.message : "Errore imprevisto"}</p>`;
  }
}

async function loadDettaglio(content, id) {
  content.innerHTML = `<p class="mono" style="color:var(--mute)">Carico...</p>`;
  try {
    const m = await api.get(`/programma/${id}`);
    const merende = (m.merende ?? []).filter((mf) => merendaDisponibile(mf.data));

    content.innerHTML = `
      <div class="card">
        <p class="mono" style="color:var(--accent); font-size:12px">${MESI[m.mese - 1].toUpperCase()} · ${m.anno}</p>

        <p class="sezione-label" style="margin-top:14px">Focus del mese</p>
        <h2 style="margin-top:10px; color:var(--accent)">${m.focusTema ?? "Focus del mese"}</h2>

        <div style="margin-top:20px">
          ${bloccoTendina("Obiettivo", m.obiettivo && `<p style="margin-top:10px">${m.obiettivo}</p>`)}
          ${bloccoTendina("Perché questo mese", m.percheMese && paragrafi(m.percheMese))}
          ${bloccoTendina("Risultato atteso", m.risultatoAtteso && paragrafi(m.risultatoAtteso))}
          ${bloccoTendina(
            "Sane abitudini",
            [
              m.focusNutrizionale && `<p style="margin-top:10px; color:var(--accent); font-weight:600">${m.focusNutrizionale}</p>`,
              m.lineeGuidaNutrizionali && puntiElenco(m.lineeGuidaNutrizionali),
              m.obiettivoNutrizionale && `<p class="mono" style="margin-top:12px; font-size:13px; color:var(--mute)">Obiettivo — ${m.obiettivoNutrizionale}</p>`,
            ]
              .filter(Boolean)
              .join("")
          )}
        </div>

        ${
          merende.length
            ? `
              <p class="sezione-label" style="margin-top:20px">Merende fit</p>
              <div style="display:flex; flex-direction:column; gap:12px; margin-top:10px">
                ${merende
                  .map((mf) => {
                    const link = mf.linkUrl ? linkSicuro(mf.linkUrl) : null;
                    const data = mf.data ? etichettaData(mf.data) : null;
                    const titolo = (mf.titolo ?? "").trim();
                    return `
                      <div class="card" style="background:var(--surface-2)">
                        ${mf.fotoUrl ? `<img src="${mediaUrl(mf.fotoUrl)}" alt="" style="width:100%; border-radius:12px; display:block; margin-bottom:10px" />` : ""}
                        ${data ? `<p class="mono" style="color:var(--accent); font-size:11px">${data}</p>` : ""}
                        ${titolo ? `<p style="font-weight:600; font-size:14px; margin-top:${data ? "2px" : "0"}">${titolo}</p>` : ""}
                        ${mf.descrizione ? `<p class="mono" style="color:var(--mute); font-size:12px; margin-top:${data || titolo ? "4px" : "0"}">${mf.descrizione}</p>` : ""}
                        ${link ? `<a href="${link}" target="_blank" rel="noopener noreferrer" class="mono" style="color:var(--accent); font-size:12px; display:inline-block; margin-top:8px">▶ Guarda la video ricetta</a>` : ""}
                      </div>
                    `;
                  })
                  .join("")}
              </div>
            `
            : ""
        }
      </div>
    `;
  } catch (err) {
    content.innerHTML = `<p class="error-text">${err instanceof ApiError ? err.message : "Errore imprevisto"}</p>`;
  }
}
