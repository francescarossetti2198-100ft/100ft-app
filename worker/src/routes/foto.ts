import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import { requireAuth } from "../middleware/auth";

type Variables = { user: SessionUser };
const foto = new Hono<{ Bindings: Env; Variables: Variables }>();

foto.get("/:prefisso/:file", requireAuth, async (c) => {
  const chiave = `${c.req.param("prefisso")}/${c.req.param("file")}`;
  const oggetto = await c.env.FOTO_SFIDE.get(chiave);
  if (!oggetto) return c.notFound();

  const headers: Record<string, string> = {
    "Content-Type": oggetto.httpMetadata?.contentType ?? "image/jpeg",
  };
  // Documenti (diario allenamenti): Content-Disposition col nome originale → il download
  // salva "scheda-lunedi.pdf" invece dell'UUID interno.
  if (oggetto.httpMetadata?.contentDisposition) {
    headers["Content-Disposition"] = oggetto.httpMetadata.contentDisposition;
  }
  return new Response(oggetto.body, { headers });
});

export default foto;
