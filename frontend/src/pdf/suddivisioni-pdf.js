// "Saldo mese" — resoconto abbonamenti da consegnare alla palestra. Un mese: tabella con
// tutti gli iscritti (atleta, abbonamento, dovuto a 100FT, dovuto a FITNESSDREAM), i totali
// (solo di chi ha pagato) e la ripartizione % per abbonamento come promemoria.
// jsPDF è importato qui (import dinamico dal chiamante) così resta fuori dal bundle principale.

const MESI_DEFAULT = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

// Importi in stile italiano: "30,00 €".
const eur = (n) => `${Number(n).toFixed(2).replace(".", ",")} €`;

const COACH = "100FT";
const PALESTRA = "FITNESSDREAM";

export async function scaricaSuddivisioniPdf(dati, mesi = MESI_DEFAULT, piani = []) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 52; // margine
  const right = W - M;
  const fondo = H - 60;

  // Colonne della tabella (le due quote sono allineate a destra alle rispettive ascisse).
  const contentW = W - 2 * M;
  const cAtleta = M;
  const cAbb = M + contentW * 0.36;
  const cCoach = M + contentW * 0.72;
  const cPal = right;

  const grigio = [110, 110, 110];
  const nero = [20, 20, 20];
  const lineaCol = [205, 205, 205];

  const nomeMese = mesi[dati.mese - 1] ?? String(dati.mese);
  const oggi = new Date().toLocaleDateString("it-IT");

  let y = 0;
  let pagina = 0;

  const setColor = (c) => doc.setTextColor(c[0], c[1], c[2]);

  const intestazioneTabella = () => {
    doc.setFillColor(28, 28, 28);
    doc.rect(M, y, W - 2 * M, 20, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text("ATLETA", cAtleta + 6, y + 13);
    doc.text("ABBONAMENTO", cAbb, y + 13);
    doc.text(`QUOTA ${COACH}`, cCoach, y + 13, { align: "right" });
    doc.text(`QUOTA ${PALESTRA}`, cPal - 6, y + 13, { align: "right" });
    y += 20;
  };

  const nuovaPagina = () => {
    if (pagina > 0) doc.addPage();
    pagina += 1;
    y = 56;

    // Testata documento.
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    setColor(nero);
    doc.text("100FT · Functional Training", M, y);
    y += 20;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    setColor(grigio);
    doc.text(`Saldo mese ${nomeMese} ${dati.anno}`, M, y);
    y += 14;
    doc.setDrawColor(lineaCol[0], lineaCol[1], lineaCol[2]);
    doc.setLineWidth(1);
    doc.line(M, y, right, y);
    y += 18;

    intestazioneTabella();
  };

  const spazioPerRiga = (h) => {
    if (y + h > fondo) {
      nuovaPagina();
    }
  };

  nuovaPagina();

  // ── Righe atleti ────────────────────────────────────────────────────────
  doc.setFontSize(10);
  let i = 0;
  for (const r of dati.righe) {
    spazioPerRiga(18);
    const hRiga = 18;
    if (i % 2 === 1) {
      doc.setFillColor(246, 246, 246);
      doc.rect(M, y, W - 2 * M, hRiga, "F");
    }
    const ty = y + 12;
    doc.setFont("helvetica", "normal");
    if (r.pagato) {
      setColor(nero);
      doc.text(r.nome, cAtleta + 6, ty);
      doc.text(r.nomePiano ?? r.piano, cAbb, ty);
      if (r.quotaCoach != null) {
        doc.text(eur(r.quotaCoach), cCoach, ty, { align: "right" });
        doc.text(eur(r.quotaPalestra), cPal - 6, ty, { align: "right" });
      } else {
        setColor(grigio);
        doc.text("% da definire", cPal - 6, ty, { align: "right" });
      }
    } else {
      setColor(grigio);
      doc.text(r.nome, cAtleta + 6, ty);
      doc.text(`${r.nomePiano ?? r.piano}`, cAbb, ty);
      doc.text("non pagato", cPal - 6, ty, { align: "right" });
    }
    y += hRiga;
    i += 1;
  }
  if (dati.righe.length === 0) {
    setColor(grigio);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.text("Nessun iscritto con abbonamento per questo mese.", cAtleta + 6, y + 14);
    y += 24;
  }

  // ── Totali ──────────────────────────────────────────────────────────────
  spazioPerRiga(90);
  y += 6;
  doc.setDrawColor(lineaCol[0], lineaCol[1], lineaCol[2]);
  doc.setLineWidth(1);
  doc.line(M, y, right, y);
  y += 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setColor(grigio);
  doc.text("TOTALE DEL MESE — solo iscritti che hanno pagato", M, y);
  y += 20;

  const rigaTotale = (etichetta, valore, forte) => {
    doc.setFont("helvetica", forte ? "bold" : "normal");
    doc.setFontSize(forte ? 13 : 11);
    setColor(nero);
    doc.text(etichetta, M, y);
    doc.text(eur(valore), right, y, { align: "right" });
    y += forte ? 20 : 16;
  };
  rigaTotale(`Dovuto a ${COACH}`, dati.totali.coach, true);
  rigaTotale(`Dovuto a ${PALESTRA}`, dati.totali.palestra, true);
  if (dati.totali.daDefinire) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    setColor(grigio);
    doc.text(`Da definire (piano senza % impostata): ${eur(dati.totali.daDefinire)}`, M, y);
    y += 16;
  }

  // ── Promemoria ripartizioni ─────────────────────────────────────────────
  const cfg = dati.config ?? {};
  const vociCfg = piani.length
    ? piani.map((p) => ({ nome: p.nome, prezzo: p.prezzo, pct: cfg[p.key] ?? null }))
    : Object.entries(cfg).map(([k, pct]) => ({ nome: k.toUpperCase(), prezzo: null, pct: pct ?? null }));

  spazioPerRiga(40 + vociCfg.length * 15);
  y += 12;
  doc.setDrawColor(lineaCol[0], lineaCol[1], lineaCol[2]);
  doc.line(M, y, right, y);
  y += 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  setColor(grigio);
  doc.text("PROMEMORIA — RIPARTIZIONE PER ABBONAMENTO", M, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  for (const v of vociCfg) {
    setColor(nero);
    doc.text(v.prezzo != null ? `${v.nome} — ${eur(v.prezzo)}/mese` : v.nome, M, y);
    setColor(grigio);
    doc.text(
      v.pct != null ? `${v.pct}% ${COACH} · ${100 - v.pct}% ${PALESTRA}` : "da definire",
      right,
      y,
      { align: "right" }
    );
    y += 15;
  }

  // ── Footer su ogni pagina ───────────────────────────────────────────────
  const totPag = doc.getNumberOfPages();
  for (let p = 1; p <= totPag; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setColor(grigio);
    doc.text(`Documento generato il ${oggi} · 100FT`, M, H - 32);
    doc.text(`Pagina ${p} di ${totPag}`, right, H - 32, { align: "right" });
  }

  doc.save(`100FT-saldo-${nomeMese.toLowerCase()}-${dati.anno}.pdf`);
}
