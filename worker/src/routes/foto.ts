import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import { requireAuth } from "../middleware/auth";

type Variables = { user: SessionUser };
const foto = new Hono<{ Bindings: Env; Variables: Variables }>();

foto.get("/:prefisso/:file", requireAuth, async (c) => {
  const chiave = `${c.req.param("prefisso")}/${c.req.param("file")}`;
  const oggetto = await c.env.FOTO_SFIDE.get(chiave);
  if (!oggetto) return c.notFound();

  return new Response(oggetto.body, {
    headers: { "Content-Type": oggetto.httpMetadata?.contentType ?? "image/jpeg" },
  });
});

export default foto;
