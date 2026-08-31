// Resoconto abbonamenti in PDF da consegnare alla palestra: un mese, tabella con tutti gli
// iscritti (nome · abbonamento · quota coach · quota palestra), totali (solo chi ha pagato)
// e le percentuali per abbonamento come promemoria.
// jsPDF è importato qui (import dinamico dal chiamante) così resta fuori dal bundle principale.

const MESI_DEFAULT = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

const eur = (n) => (Number.isInteger(n) ? `${n} EUR` : `${n.toFixed(2)} EUR`);

export async function scaricaSuddivisioniPdf(dati, mesi = MESI_DEFAULT, config = null) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const marginX = 48;
  const larghezza = doc.internal.pageSize.getWidth() - marginX * 2;
  const fondo = doc.internal.pageSize.getHeight() - 56;
  let y = 60;

  const nuovaPaginaSeServe = (h) => {
    if (y + h > fondo) {
      doc.addPage();
      y = 60;
    }
  };

  // Colonne: nome | abbonamento | a te | palestra.
  const colAbb = marginX + larghezza * 0.5;
  const colTe = marginX + larghezza * 0.78;
  const colPal = marginX + larghezza;

  const nomeMese = mesi[dati.mese - 1] ?? String(dati.mese);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("100FT — Resoconto abbonamenti", marginX, y);
  y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(90);
  doc.text(`${nomeMese} ${dati.anno}`, marginX, y);
  doc.setTextColor(0);
  y += 22;

  // Intestazione tabella.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("NOME", marginX, y);
  doc.text("ABBONAMENTO", colAbb, y);
  doc.text("A TE", colTe, y, { align: "right" });
  doc.text("PALESTRA", colPal, y, { align: "right" });
  doc.setTextColor(0);
  y += 6;
  doc.setDrawColor(200);
  doc.line(marginX, y, colPal, y);
  y += 12;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  if (dati.righe.length === 0) {
    doc.text("Nessun atleta con abbonamento per questo mese.", marginX, y);
    doc.save(`suddivisioni-${dati.anno}-${dati.mese}.pdf`);
    return;
  }

  for (const r of dati.righe) {
    nuovaPaginaSeServe(16);
    if (!r.pagato) doc.setTextColor(150);
    doc.text(r.nome + (r.pagato ? "" : "  (non pagato)"), marginX, y);
    doc.text(r.nomePiano ?? r.piano, colAbb, y);
    if (r.quotaCoach != null) {
      doc.text(eur(r.quotaCoach), colTe, y, { align: "right" });
      doc.text(eur(r.quotaPalestra), colPal, y, { align: "right" });
    } else {
      doc.text("% da definire", colPal, y, { align: "right" });
    }
    doc.setTextColor(0);
    y += 15;
  }

  // Totali (solo chi ha pagato).
  nuovaPaginaSeServe(70);
  y += 6;
  doc.setDrawColor(150);
  doc.line(marginX, y, colPal, y);
  y += 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Totale del mese (solo chi ha pagato)", marginX, y);
  y += 18;
  doc.setFontSize(11);
  doc.text("A te", marginX, y);
  doc.text(eur(dati.totali.coach), colPal, y, { align: "right" });
  y += 15;
  doc.text("A Cosimo (palestra)", marginX, y);
  doc.text(eur(dati.totali.palestra), colPal, y, { align: "right" });
  if (dati.totali.daDefinire) {
    y += 15;
    doc.text("Da definire", marginX, y);
    doc.text(eur(dati.totali.daDefinire), colPal, y, { align: "right" });
  }
  y += 26;

  // Promemoria: le percentuali per abbonamento.
  const cfg = config ?? dati.config ?? {};
  nuovaPaginaSeServe(30 + Object.keys(cfg).length * 14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text("PROMEMORIA — QUOTA COACH PER ABBONAMENTO", marginX, y);
  doc.setTextColor(0);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  for (const [piano, pct] of Object.entries(cfg)) {
    doc.text(`${piano.toUpperCase()}`, marginX, y);
    doc.text(pct != null ? `${pct}% a te · ${100 - pct}% palestra` : "da definire", colPal, y, { align: "right" });
    y += 14;
  }

  doc.save(`suddivisioni-${dati.anno}-${dati.mese}.pdf`);
}
