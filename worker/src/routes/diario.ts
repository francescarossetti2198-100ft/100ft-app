import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import { requireCoach } from "../middleware/auth";
import { salvaFoto, salvaFile, eliminaFoto } from "../lib/storage";

type Variables = { user: SessionUser };
const diario = new Hono<{ Bindings: Env; Variables: Variables }>();

const DATA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

const GIORNI = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
const MESI = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];

// Giorno della settimana 1=lun...7=dom di una data YYYY-MM-DD.
function giornoSettimanaDi(data: string): number {
  return ((new Date(`${data}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
}

// "lunedì 8 settembre" per il testo del post nel Feed.
function etichettaData(data: string): string {
  const d = new Date(`${data}T00:00:00Z`);
  return `${GIORNI[d.getUTCDay()]} ${d.getUTCDate()} ${MESI[d.getUTCMonth()]}`;
}

type Riga = {
  data: string;
  focus: string | null;
  nota: string | null;
  file_url: string | null;
  file_nome: string | null;
  foto_url: string | null;
  pubblicato_feed: number;
};

function serializza(data: string, r: Riga | null) {
  return {
    data,
    focus: r?.focus ?? "",
    nota: r?.nota ?? "",
    fileUrl: r?.file_url ?? null,
    fileNome: r?.file_nome ?? null,
    fotoUrl: r?.foto_url ?? null,
    pubblicatoFeed: !!r?.pubblicato_feed,
  };
}

async function rigaPerData(db: D1Database, data: string): Promise<Riga | null> {
  return db
    .prepare(
      `SELECT data, focus, nota, file_url, file_nome, foto_url, pubblicato_feed
       FROM diario_allenamenti WHERE data = ?`
    )
    .bind(data)
    .first<Riga>();
}

// Assicura che esista la riga per quella data (upsert dei soli campi passati), poi la ritorna.
async function upsertRiga(
  db: D1Database,
  data: string,
  campi: Partial<Record<"focus" | "nota" | "file_url" | "file_nome" | "foto_url", string | null>>
): Promise<void> {
  const cols = Object.keys(campi);
  const insertCols = ["data", ...cols].join(", ");
  const insertVals = ["?", ...cols.map(() => "?")].join(", ");
  const updateSet = [...cols.map((c) => `${c} = excluded.${c}`), "aggiornato_il = datetime('now')"].join(", ");
  await db
    .prepare(
      `INSERT INTO diario_allenamenti (${insertCols}) VALUES (${insertVals})
       ON CONFLICT (data) DO UPDATE SET ${updateSet}`
    )
    .bind(data, ...cols.map((c) => campi[c as keyof typeof campi] ?? null))
    .run();
}

// ── Griglia del mese ─────────────────────────────────────────────────────────
// Una voce per ogni giorno di allenamento (giorno-settimana presente in sessioni_gruppo)
// del mese, esclusi i giorni di chiusura. Include il focus_tema del mese per il prefill.
diario.get("/", requireCoach, async (c) => {
  const anno = Number(c.req.query("anno"));
  const mese = Number(c.req.query("mese"));
  if (!Number.isInteger(anno) || !Number.isInteger(mese) || mese < 1 || mese > 12) {
    return c.json({ error: "Anno e mese non validi" }, 400);
  }

  const { results: sess } = await c.env.DB.prepare(
    `SELECT DISTINCT giorno_settimana FROM sessioni_gruppo`
  ).all<{ giorno_settimana: number }>();
  const giorniSessione = new Set(sess.map((r) => r.giorno_settimana));

  const ultimo = new Date(Date.UTC(anno, mese, 0)).getUTCDate();
  const date: string[] = [];
  for (let d = 1; d <= ultimo; d++) {
    const iso = `${anno}-${String(mese).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (giorniSessione.has(giornoSettimanaDi(iso))) date.push(iso);
  }

  const inizio = `${anno}-${String(mese).padStart(2, "0")}-01`;
  const fine = `${anno}-${String(mese).padStart(2, "0")}-${String(ultimo).padStart(2, "0")}`;

  const [{ results: righe }, { results: chiusi }, programma] = await Promise.all([
    c.env.DB.prepare(
      `SELECT data, focus, nota, file_url, file_nome, foto_url, pubblicato_feed
       FROM diario_allenamenti WHERE data >= ? AND data <= ?`
    )
      .bind(inizio, fine)
      .all<Riga>(),
    c.env.DB.prepare(`SELECT data FROM giorni_chiusi WHERE data >= ? AND data <= ?`)
      .bind(inizio, fine)
      .all<{ data: string }>(),
    c.env.DB.prepare(`SELECT focus_tema AS focusTema FROM programma_mensile WHERE mese = ? AND anno = ?`)
      .bind(mese, anno)
      .first<{ focusTema: string | null }>(),
  ]);

  const perData = new Map(righe.map((r) => [r.data, r]));
  const chiusiSet = new Set(chiusi.map((r) => r.data));

  return c.json({
    focusMese: programma?.focusTema ?? null,
    giorni: date.filter((d) => !chiusiSet.has(d)).map((d) => serializza(d, perData.get(d) ?? null)),
  });
});

diario.get("/:data", requireCoach, async (c) => {
  const data = c.req.param("data") ?? "";
  if (!DATA_REGEX.test(data)) return c.json({ error: "Data non valida" }, 400);
  return c.json(serializza(data, await rigaPerData(c.env.DB, data)));
});

// Salva focus + nota di un giorno (il form manda sempre entrambi → svuotabili).
diario.post("/", requireCoach, async (c) => {
  const { data, focus, nota } = await c.req.json<{ data?: string; focus?: string; nota?: string }>();
  if (!data || !DATA_REGEX.test(data)) return c.json({ error: "Data non valida" }, 400);
  await upsertRiga(c.env.DB, data, {
    focus: focus?.trim() || null,
    nota: nota?.trim() || null,
  });
  return c.json(serializza(data, await rigaPerData(c.env.DB, data)));
});

// Upload dell'allegato PDF/Word.
diario.post("/file", requireCoach, async (c) => {
  const body = await c.req.parseBody();
  const data = typeof body.data === "string" ? body.data : "";
  const file = body.file instanceof File ? body.file : null;
  if (!DATA_REGEX.test(data)) return c.json({ error: "Data non valida" }, 400);
  if (!file) return c.json({ error: "Serve un file" }, 400);
  if (file.size > MAX_FILE_BYTES) return c.json({ error: "Il file supera i 10 MB" }, 400);

  let salvato: { url: string; nome: string };
  try {
    salvato = await salvaFile(c.env.FOTO_SFIDE, "diario", file);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Upload non riuscito" }, 400);
  }

  const esistente = await rigaPerData(c.env.DB, data);
  await eliminaFoto(c.env.FOTO_SFIDE, esistente?.file_url);
  await upsertRiga(c.env.DB, data, { file_url: salvato.url, file_nome: salvato.nome });
  return c.json({ fileUrl: salvato.url, fileNome: salvato.nome });
});

// Upload della foto opzionale.
diario.post("/foto", requireCoach, async (c) => {
  const body = await c.req.parseBody();
  const data = typeof body.data === "string" ? body.data : "";
  const foto = body.foto instanceof File ? body.foto : null;
  if (!DATA_REGEX.test(data)) return c.json({ error: "Data non valida" }, 400);
  if (!foto) return c.json({ error: "Serve un'immagine" }, 400);

  const esistente = await rigaPerData(c.env.DB, data);
  await eliminaFoto(c.env.FOTO_SFIDE, esistente?.foto_url);
  const fotoUrl = await salvaFoto(c.env.FOTO_SFIDE, "diario", foto);
  await upsertRiga(c.env.DB, data, { foto_url: fotoUrl });
  return c.json({ fotoUrl });
});

diario.delete("/:data/file", requireCoach, async (c) => {
  const data = c.req.param("data") ?? "";
  if (!DATA_REGEX.test(data)) return c.json({ error: "Data non valida" }, 400);
  const esistente = await rigaPerData(c.env.DB, data);
  await eliminaFoto(c.env.FOTO_SFIDE, esistente?.file_url);
  await c.env.DB.prepare(
    `UPDATE diario_allenamenti SET file_url = NULL, file_nome = NULL, aggiornato_il = datetime('now') WHERE data = ?`
  )
    .bind(data)
    .run();
  return c.json({ ok: true });
});

diario.delete("/:data/foto", requireCoach, async (c) => {
  const data = c.req.param("data") ?? "";
  if (!DATA_REGEX.test(data)) return c.json({ error: "Data non valida" }, 400);
  const esistente = await rigaPerData(c.env.DB, data);
  await eliminaFoto(c.env.FOTO_SFIDE, esistente?.foto_url);
  await c.env.DB.prepare(
    `UPDATE diario_allenamenti SET foto_url = NULL, aggiornato_il = datetime('now') WHERE data = ?`
  )
    .bind(data)
    .run();
  return c.json({ ok: true });
});

diario.delete("/:data", requireCoach, async (c) => {
  const data = c.req.param("data") ?? "";
  if (!DATA_REGEX.test(data)) return c.json({ error: "Data non valida" }, 400);
  const esistente = await rigaPerData(c.env.DB, data);
  if (esistente) {
    await eliminaFoto(c.env.FOTO_SFIDE, esistente.file_url);
    await eliminaFoto(c.env.FOTO_SFIDE, esistente.foto_url);
    await c.env.DB.prepare(`DELETE FROM diario_allenamenti WHERE data = ?`).bind(data).run();
  }
  return c.json({ ok: true });
});

// Pubblica la voce nel Feed: la coach sceglie voce per voce cosa includere.
diario.post("/:data/pubblica", requireCoach, async (c) => {
  const data = c.req.param("data") ?? "";
  if (!DATA_REGEX.test(data)) return c.json({ error: "Data non valida" }, 400);

  const { includiFocus, includiNota, includiFile, includiFoto } = await c.req.json<{
    includiFocus?: boolean;
    includiNota?: boolean;
    includiFile?: boolean;
    includiFoto?: boolean;
  }>();

  const riga = await rigaPerData(c.env.DB, data);
  if (!riga) return c.json({ error: "Nessuna voce di diario per questa data" }, 404);

  const righeTesto = [`Allenamento di ${etichettaData(data)}`];
  if (includiFocus && riga.focus?.trim()) righeTesto.push("", riga.focus.trim());
  if (includiNota && riga.nota?.trim()) righeTesto.push("", riga.nota.trim());

  const contenutoUrl = includiFoto ? riga.foto_url : null;
  const allegatoUrl = includiFile ? riga.file_url : null;
  const allegatoNome = includiFile ? riga.file_nome : null;

  await c.env.DB.prepare(
    `INSERT INTO post_feed (user_id, tipo, testo, contenuto_url, allegato_url, allegato_nome)
     VALUES (NULL, 'allenamento', ?, ?, ?, ?)`
  )
    .bind(righeTesto.join("\n"), contenutoUrl, allegatoUrl, allegatoNome)
    .run();

  await c.env.DB.prepare(
    `UPDATE diario_allenamenti SET pubblicato_feed = 1, aggiornato_il = datetime('now') WHERE data = ?`
  )
    .bind(data)
    .run();

  return c.json({ ok: true }, 201);
});

export default diario;
