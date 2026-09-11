// Sfondo vivo e decorativo per la card identità del Profilo (foto + nickname + nome/
// cognome + livello): un reticolo esagonale che respira lentamente tra flusso organico
// e un breve istante di ordine cristallino, nel colore accento del tema — sempre lo
// stesso, sia chiaro che scuro. Puramente ambientale: nessun controllo, nessuna
// interazione. Si ferma da sola quando la card esce dal DOM (cambio pagina) e non
// viene montata affatto se l'utente preferisce animazioni ridotte.
export function montaCampoVivo(card) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const wrap = document.createElement("div");
  wrap.setAttribute("aria-hidden", "true");
  wrap.style.cssText = "position:absolute; inset:0; z-index:0; border-radius:inherit; overflow:hidden; pointer-events:none;";
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:absolute; inset:0; width:100%; height:100%; display:block;";
  wrap.appendChild(canvas);
  card.insertBefore(wrap, card.firstChild);

  const ctx = canvas.getContext("2d");
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

  let w = 0, h = 0, anchors = [], edges = [], particles = [], t = 0, lastTime = null;

  const accentColor = () => getComputedStyle(card).getPropertyValue("--accent").trim() || "#8b5cf6";

  function buildHoneycomb(hexSize) {
    const hexW = Math.sqrt(3) * hexSize;
    const vertStep = hexSize * 1.5;
    const centers = [];
    let row = 0;
    for (let y = -hexSize; y < h + hexSize; y += vertStep) {
      const offsetX = (row % 2) * (hexW / 2);
      for (let x = -hexSize; x < w + hexSize; x += hexW) centers.push({ x: x + offsetX, y });
      row++;
    }

    const built = [];
    const vertMap = new Map();
    const edgeSet = new Set();
    const builtEdges = [];

    function getIdx(px, py) {
      const key = `${Math.round(px * 8)}_${Math.round(py * 8)}`;
      if (vertMap.has(key)) return vertMap.get(key);
      const idx = built.length;
      built.push({ x: px, y: py });
      vertMap.set(key, idx);
      return idx;
    }

    for (const c of centers) {
      const corners = [];
      for (let k = 0; k < 6; k++) {
        const ang = (Math.PI / 180) * (60 * k - 30);
        corners.push(getIdx(c.x + hexSize * Math.cos(ang), c.y + hexSize * Math.sin(ang)));
      }
      for (let e = 0; e < 6; e++) {
        const a = corners[e], b = corners[(e + 1) % 6];
        const key = a < b ? `${a}-${b}` : `${b}-${a}`;
        if (!edgeSet.has(key)) { edgeSet.add(key); builtEdges.push([a, b]); }
      }
    }
    return { anchors: built, edges: builtEdges };
  }

  function regenerate() {
    const targetCount = 24;
    const hexSize = Math.max(24, Math.min(58, Math.sqrt((w * h) / targetCount) * 0.85));
    const built = buildHoneycomb(hexSize);
    anchors = built.anchors;
    edges = built.edges;
    particles = anchors.map(() => ({
      x: w * 0.5 + (Math.random() - 0.5) * w,
      y: h * 0.5 + (Math.random() - 0.5) * h,
      vx: 0,
      vy: 0,
    }));
  }

  function resize() {
    const rect = card.getBoundingClientRect();
    w = Math.max(1, rect.width);
    h = Math.max(1, rect.height);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    regenerate();
  }

  function flow(x, y, tt) {
    const s = 0.006;
    const fx = Math.sin(y * s + tt * 0.5) * 0.6 + Math.sin((x + y) * s * 0.6 - tt * 0.3) * 0.4;
    const fy = Math.cos(x * s - tt * 0.4) * 0.6 + Math.cos((x - y) * s * 0.6 + tt * 0.35) * 0.4;
    return { fx, fy };
  }

  function orderAt(anchor, tt) {
    const span = w + h || 1;
    const angle = 0.5;
    const proj = anchor.x * Math.cos(angle) + anchor.y * Math.sin(angle);
    const bandT = ((tt * 34) % (span * 1.8)) - span * 0.4;
    const dist = proj - bandT;
    const band = Math.exp(-(dist * dist) / (2 * 60 * 60));
    return Math.min(0.75, 0.06 + band * 0.68);
  }

  function step(dt) {
    t += (dt * 0.8) / 60;
    for (let i = 0; i < anchors.length; i++) {
      const a = anchors[i];
      const p = particles[i];
      const ord = orderAt(a, t);
      const fl = flow(p.x, p.y, t);
      const flowK = 20 * (1 - ord * 0.9);
      const springK = 0.02 + ord * 0.1;
      const ax = fl.fx * flowK + (a.x - p.x) * springK;
      const ay = fl.fy * flowK + (a.y - p.y) * springK;
      p.vx = (p.vx + ax * dt) * 0.9;
      p.vy = (p.vy + ay * dt) * 0.9;
      p.x += p.vx;
      p.y += p.vy;
      a._order = ord;
    }
  }

  function draw() {
    const col = accentColor();
    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 1;
    for (const [i, j] of edges) {
      const pa = particles[i], pb = particles[j];
      const ord = ((anchors[i]._order || 0) + (anchors[j]._order || 0)) / 2;
      ctx.globalAlpha = 0.03 + ord * 0.15;
      ctx.strokeStyle = col;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }
    for (let i = 0; i < anchors.length; i++) {
      const p = particles[i];
      const ord = anchors[i]._order || 0;
      ctx.globalAlpha = 0.14 + ord * 0.32;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.2 + ord * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function stop() {
    ro.disconnect();
  }

  function frame(now) {
    if (!canvas.isConnected) { stop(); return; }
    if (lastTime === null) lastTime = now;
    const dt = Math.min(2, (now - lastTime) / 16.67);
    lastTime = now;
    step(dt);
    draw();
    requestAnimationFrame(frame);
  }

  let resizeTimer;
  const ro = new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!canvas.isConnected) { stop(); return; }
      resize();
    }, 150);
  });
  ro.observe(card);

  resize();
  requestAnimationFrame(frame);
}
