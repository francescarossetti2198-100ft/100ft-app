// Questionario a risposta guidata condiviso — usato dalla card "Personalizza il tuo
// profilo" (profilo.js) e dal questionario mensile (home.js).
// Tipi di domanda: "singola", "multipla" (con `max` opzionale), "faccine" (le 5 faccine
// fisse 😫 😕 😐 🙂 🔥, mai sostituite).
// Un'opzione `multipla` con `esclusiva: true` (es. "No, solo 100FT" / "Niente, va bene
// così") si comporta come una scelta a parte: selezionarla azzera le altre e selezionarne
// un'altra la deseleziona.

// Le 5 faccine: sempre queste, in quest'ordine. Valore salvato = "1".."5".
const FACCE = [
  { v: "1", emoji: "😫" },
  { v: "2", emoji: "😕" },
  { v: "3", emoji: "😐" },
  { v: "4", emoji: "🙂" },
  { v: "5", emoji: "🔥" },
];

export function pillStyle(on) {
  return on
    ? "background:var(--accent); border:1px solid var(--accent); border-radius:999px; padding:7px 12px; font-size:13px; color:#fff; cursor:pointer; font-family:inherit"
    : "background:var(--surface-2); border:1px solid var(--border); border-radius:999px; padding:7px 12px; font-size:13px; color:var(--text); cursor:pointer; font-family:inherit";
}

function facciaStyle(on) {
  return `font-size:26px; line-height:1; width:44px; height:44px; border-radius:50%; background:var(--bg); cursor:pointer; padding:0; border:1px solid ${
    on ? "var(--accent)" : "var(--border)"
  }; outline:${on ? "2px solid var(--accent)" : "none"}; outline-offset:2px`;
}

function opzioniDi(d) {
  return d.tipo === "faccine" ? FACCE.map((f) => ({ v: f.v, label: f.emoji })) : d.opzioni || [];
}

function selezionata(scelte, id, v) {
  const s = scelte[id];
  return Array.isArray(s) ? s.includes(v) : s === v;
}

function domandaHtml(d, scelte) {
  const faccia = d.tipo === "faccine";
  const hint =
    d.tipo === "multipla"
      ? `<p class="mono" style="color:var(--mute); font-size:11px; margin-top:2px">${d.max ? `Fino a ${d.max}` : "Più di una"}</p>`
      : "";
  return `
    <div class="q-domanda" data-id="${d.id}" data-tipo="${d.tipo}" data-max="${d.max ?? 0}" style="margin-bottom:16px">
      <p style="font-size:14px; font-weight:600">${d.testo}</p>
      ${hint}
      <div style="display:flex; flex-wrap:wrap; gap:${faccia ? "10px" : "6px"}; margin-top:8px${faccia ? "; justify-content:space-between" : ""}">
        ${opzioniDi(d)
          .map(
            (o) =>
              `<button type="button" class="q-opt" data-v="${o.v}" data-esclusiva="${o.esclusiva ? 1 : 0}" style="${
                faccia ? facciaStyle(selezionata(scelte, d.id, o.v)) : pillStyle(selezionata(scelte, d.id, o.v))
              }">${o.label}</button>`
          )
          .join("")}
      </div>
    </div>`;
}

// Renderizza i gruppi di pill dentro `container`, gestisce lo stato interno e restituisce
// { getRisposte() }. Il chiamante fornisce i bottoni Salva/Annulla e la logica di invio.
export function costruisciQuestionario(container, domande, scelteIniziali = {}) {
  const scelte = {};
  for (const d of domande) {
    const v = scelteIniziali?.[d.id];
    if (v != null) scelte[d.id] = Array.isArray(v) ? [...v] : v;
  }

  container.innerHTML = domande.map((d) => domandaHtml(d, scelte)).join("");

  container.querySelectorAll(".q-domanda").forEach((grp) => {
    const id = grp.dataset.id;
    const tipo = grp.dataset.tipo;
    const max = Number(grp.dataset.max || 0);
    const faccia = tipo === "faccine";
    grp.querySelectorAll(".q-opt").forEach((btn) => {
      btn.addEventListener("click", () => {
        const v = btn.dataset.v;
        if (tipo === "multipla") {
          const arr = Array.isArray(scelte[id]) ? scelte[id] : [];
          const esclusive = [...grp.querySelectorAll(".q-opt")]
            .filter((b) => b.dataset.esclusiva === "1")
            .map((b) => b.dataset.v);
          if (arr.includes(v)) {
            scelte[id] = arr.filter((x) => x !== v);
          } else if (btn.dataset.esclusiva === "1") {
            scelte[id] = [v]; // un'opzione esclusiva azzera tutte le altre
          } else {
            const senzaEsclusive = arr.filter((x) => !esclusive.includes(x));
            if (!max || senzaEsclusive.length < max) scelte[id] = [...senzaEsclusive, v];
            else return;
          }
        } else {
          scelte[id] = scelte[id] === v ? undefined : v;
        }
        grp.querySelectorAll(".q-opt").forEach((b) => {
          const on = selezionata(scelte, id, b.dataset.v);
          b.style.cssText = faccia ? facciaStyle(on) : pillStyle(on);
        });
      });
    });
  });

  return {
    getRisposte() {
      const out = {};
      for (const [k, v] of Object.entries(scelte)) {
        if (v == null || (Array.isArray(v) && v.length === 0)) continue;
        out[k] = v;
      }
      return out;
    },
  };
}

// [{ emoji, label }] — una voce per ogni opzione selezionata (non una per domanda).
// Usato dalla card "Obiettivi personali" del profilo: elenco puntato con emoji.
export function elencoRisposte(domande, risposte) {
  const out = [];
  for (const d of domande) {
    const v = risposte?.[d.id];
    if (v == null || (Array.isArray(v) && v.length === 0)) continue;
    for (const x of Array.isArray(v) ? v : [v]) {
      const o = d.opzioni?.find((op) => op.v === x);
      out.push({ emoji: o?.emoji ?? "•", label: o?.label ?? String(x) });
    }
  }
  return out;
}

// [{ testo, risposta }] con le label leggibili — per i riassunti (profilo + scheda coach).
export function riassuntoRisposte(domande, risposte) {
  const out = [];
  for (const d of domande) {
    const v = risposte?.[d.id];
    if (v == null || (Array.isArray(v) && v.length === 0)) continue;
    let risposta;
    if (d.tipo === "faccine") {
      risposta = FACCE.find((f) => f.v === String(v))?.emoji ?? String(v);
    } else {
      risposta = (Array.isArray(v) ? v : [v])
        .map((x) => d.opzioni?.find((o) => o.v === x)?.label ?? x)
        .join(", ");
    }
    out.push({ testo: d.testo, risposta });
  }
  return out;
}
