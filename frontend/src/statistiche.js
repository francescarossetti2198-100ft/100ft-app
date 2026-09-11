// Sotto-sezione "Statistiche" della card "I tuoi progressi" (Profilo atleta).
// Dati: GET /profilo/statistiche -> { presenze:[iso], feedback:[{data,faccina,difficolta}],
//   sfide:[{data,punti}], settimaneCompletateTotali, allenamentiFatti }.
// Il bucketing per periodo lo fa qui il client. Grafico a linee SVG, nessuna libreria.
import { api } from "./api.js";

const FACCINE = ["", "😫", "😕", "😐", "🙂", "🔥"]; // scala fissa (indice = faccina 1..5)
const GIORNI = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const MESI_BREVI = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
const DIFF_LABEL = { facile: "Facile", giusto: "Giusto", impegnativo: "Impegnativo", tostissimo: "Tostissimo" };

const PERIODI = [
  { v: "settimana", label: "Sett." },
  { v: "mese", label: "Mese" },
  { v: "trimestre", label: "Trim." },
  { v: "semestre", label: "Sem." },
  { v: "totale", label: "Totale" },
];

// La stagione parte a settembre 2026: le statistiche non mostrano nulla di prima.
const INIZIO_STAGIONE = "2026-09-01";

const parse = (iso) => new Date(iso + "T00:00:00");
const addDays = (d, n) => { const c = new Date(d); c.setDate(c.getDate() + n); return c; };
const lunediDi = (d) => { const c = new Date(d); c.setDate(c.getDate() - ((c.getDay() + 6) % 7)); c.setHours(0, 0, 0, 0); return c; };

// -> { from, to, buckets:[{label,from,to}], settimane }
function finestra(periodo, now, primaData) {
  const oggi = new Date(now); oggi.setHours(0, 0, 0, 0);

  if (periodo === "settimana") {
    const start = addDays(oggi, -6);
    const buckets = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, i);
      return { label: GIORNI[(d.getDay() + 6) % 7][0], from: d, to: d };
    });
    return { from: start, to: oggi, buckets, settimane: 1 };
  }

  if (periodo === "mese" || periodo === "trimestre") {
    const nWeeks = periodo === "mese" ? 5 : 13;
    const start = addDays(lunediDi(oggi), -7 * (nWeeks - 1));
    const buckets = Array.from({ length: nWeeks }, (_, i) => {
      const f = addDays(start, 7 * i);
      return { label: `${f.getDate()}/${f.getMonth() + 1}`, from: f, to: addDays(f, 6) };
    });
    return { from: start, to: oggi, buckets, settimane: nWeeks };
  }

  // semestre / totale -> bucket mensili
  let y, m;
  if (periodo === "semestre") {
    const d = new Date(oggi.getFullYear(), oggi.getMonth() - 5, 1);
    y = d.getFullYear(); m = d.getMonth();
  } else {
    const first = primaData ? parse(primaData) : oggi;
    y = first.getFullYear(); m = first.getMonth();
  }
  const buckets = [];
  while (y < oggi.getFullYear() || (y === oggi.getFullYear() && m <= oggi.getMonth())) {
    buckets.push({ label: MESI_BREVI[m], from: new Date(y, m, 1), to: new Date(y, m + 1, 0) });
    if (++m > 11) { m = 0; y++; }
  }
  const from = buckets.length ? buckets[0].from : oggi;
  const settimane = Math.max(1, Math.round((oggi - from) / (7 * 86400000)));
  return { from, to: oggi, buckets, settimane };
}

function bucketizza(date, buckets) {
  return buckets.map((b) => date.filter((iso) => {
    const d = parse(iso);
    return d >= b.from && d <= b.to;
  }).length);
}

function lineChartSvg(valori, labels, colore) {
  const W = 280, H = 104, padX = 8, topPad = 14, botPad = 16;
  const n = valori.length;
  const max = Math.max(1, ...valori) * 1.15; // un po' di aria sopra il punto più alto
  const x = (i) => (n <= 1 ? W / 2 : padX + (i * (W - padX * 2)) / (n - 1));
  const y = (v) => H - botPad - (v / max) * (H - topPad - botPad);
  const pts = valori.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const baseY = (H - botPad).toFixed(1);

  const area = `<polygon points="${x(0).toFixed(1)},${baseY} ${pts.join(" ")} ${x(n - 1).toFixed(1)},${baseY}" fill="${colore}" fill-opacity="0.12" />`;
  const line = `<polyline points="${pts.join(" ")}" fill="none" stroke="${colore}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />`;
  const dots = valori.map((v, i) =>
    `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="2.4" fill="${colore}" />`
    + (v ? `<text x="${x(i).toFixed(1)}" y="${(y(v) - 5).toFixed(1)}" text-anchor="middle" font-size="8" fill="var(--mute)">${v}</text>` : "")
  ).join("");

  const step = labels.length > 8 ? Math.ceil(labels.length / 6) : 1;
  const labs = labels.map((l, i) => (i % step === 0 || i === labels.length - 1)
    ? `<text x="${x(i).toFixed(1)}" y="${H - 3}" text-anchor="middle" font-size="8" fill="var(--mute)">${l}</text>`
    : "").join("");
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%; height:auto; display:block; margin-top:6px">${area}${line}${dots}${labs}</svg>`;
}

const rigaStat = (label, valore) => `
  <div style="display:flex; justify-content:space-between; gap:10px; padding:6px 0; border-top:1px solid var(--border)">
    <span class="mono" style="color:var(--mute); font-size:12px">${label}</span>
    <span style="font-size:13px; text-align:right; font-weight:600">${valore}</span>
  </div>`;

export async function initStatistiche(content) {
  const box = content.querySelector("#statistiche-box");
  if (!box) return;

  let dati;
  try {
    dati = await api.get("/profilo/statistiche");
  } catch {
    box.innerHTML = `<p class="error-text">Impossibile caricare le statistiche</p>`;
    return;
  }

  // Taglio a inizio stagione: qualunque dato precedente a settembre 2026 non conta.
  const daStagione = (iso) => (iso || "").slice(0, 10) >= INIZIO_STAGIONE;
  const presenze = (dati.presenze ?? []).filter(daStagione);
  const feedback = (dati.feedback ?? []).filter((f) => daStagione(f.data));
  const sfide = (dati.sfide ?? []).filter((s) => daStagione(s.data));

  if (!presenze.length && !feedback.length) {
    box.innerHTML = `<p class="mono" style="color:var(--mute); font-size:13px">Ancora niente da mostrare — completa qualche allenamento.</p>`;
    return;
  }

  const primaData = presenze[0] ?? feedback[0]?.data ?? null;
  const now = new Date();
  let periodo = "mese";

  const disegna = () => {
    const { from, to, buckets, settimane } = finestra(periodo, now, primaData);
    const perBucket = bucketizza(presenze, buckets);
    const totPres = perBucket.reduce((a, b) => a + b, 0);
    const media = (totPres / settimane).toFixed(1);

    const perGiorno = [0, 0, 0, 0, 0, 0, 0];
    presenze.forEach((iso) => perGiorno[(parse(iso).getDay() + 6) % 7]++);
    const giornoTop = perGiorno.some(Boolean) ? GIORNI[perGiorno.indexOf(Math.max(...perGiorno))] : "—";

    const perMeseKey = {};
    presenze.forEach((iso) => { const k = iso.slice(0, 7); perMeseKey[k] = (perMeseKey[k] || 0) + 1; });
    const mkeys = Object.keys(perMeseKey);
    const meseRec = mkeys.length
      ? (() => { const b = mkeys.reduce((a, k) => (perMeseKey[k] > perMeseKey[a] ? k : a)); return `${MESI_BREVI[+b.slice(5, 7) - 1]} ${b.slice(0, 4)} · ${perMeseKey[b]}`; })()
      : "—";

    const inPeriodo = (iso) => { const d = parse(iso); return d >= from && d <= to; };

    const fbP = feedback.filter((f) => inPeriodo(f.data) && f.faccina);
    const umore = fbP.length ? fbP.reduce((a, f) => a + f.faccina, 0) / fbP.length : null;
    const umoreTxt = umore ? `${FACCINE[Math.round(umore)]} ${umore.toFixed(1)}/5` : "—";

    const diffCount = {};
    feedback.filter((f) => inPeriodo(f.data) && f.difficolta).forEach((f) => { diffCount[f.difficolta] = (diffCount[f.difficolta] || 0) + 1; });
    const diffTxt = Object.keys(diffCount).length
      ? Object.entries(diffCount).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${DIFF_LABEL[k] || k} ${n}`).join(" · ")
      : "—";

    const sfP = sfide.filter((s) => inPeriodo(s.data));
    const puntiSf = sfP.reduce((a, s) => a + (s.punti || 0), 0);

    const SOGLIE = [3, 18, 36, 60, 75, 90];
    const raggiunte = SOGLIE.filter((s) => (dati.allenamentiFatti || 0) >= s).length;

    box.querySelector("#stat-chart").innerHTML = lineChartSvg(perBucket, buckets.map((b) => b.label), "var(--accent)");
    box.querySelector("#stat-righe").innerHTML =
      rigaStat("Presenze nel periodo", totPres) +
      rigaStat("Media a settimana", media) +
      rigaStat("Il tuo giorno", giornoTop) +
      rigaStat("Mese record", meseRec) +
      rigaStat("Umore medio", umoreTxt) +
      rigaStat("Come vivi gli allenamenti", diffTxt) +
      rigaStat("Sfide completate", `${sfP.length} · ${puntiSf} pt`) +
      rigaStat("Settimane completate (tot.)", dati.settimaneCompletateTotali ?? 0) +
      rigaStat("Livello", `${raggiunte}/6 soglie · ${dati.allenamentiFatti || 0} allenamenti`);
  };

  box.innerHTML = `
    <div style="display:flex; gap:5px; margin-bottom:4px">
      ${PERIODI.map((p) => `<button type="button" class="stat-per" data-p="${p.v}"
        style="flex:1; padding:5px 0; border-radius:6px; border:none; font-size:11px; cursor:pointer; font-family:inherit;
               background:var(--surface-2); color:var(--text)">${p.label}</button>`).join("")}
    </div>
    <div id="stat-chart"></div>
    <div id="stat-righe" style="margin-top:8px"></div>
  `;

  const setActive = () => box.querySelectorAll(".stat-per").forEach((b) => {
    const on = b.dataset.p === periodo;
    b.style.background = on ? "var(--accent)" : "var(--surface-2)";
    b.style.color = on ? "#fff" : "var(--text)";
  });
  box.querySelectorAll(".stat-per").forEach((b) => b.addEventListener("click", () => {
    periodo = b.dataset.p;
    setActive();
    disegna();
  }));
  setActive();
  disegna();
}
