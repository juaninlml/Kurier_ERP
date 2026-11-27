import { createHash, timingSafeEqual } from "node:crypto";
import { refreshCnyRate } from "@/lib/fx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Renueva el tipo de cambio CNY → MXN que se sugiere en las facturas.
 * La llama el cron de Vercel cada sábado a las 7:00 a. m. de la Ciudad de México (vercel.json: 13:00 UTC).
 *   GET /api/cron/tipo-cambio
 *   Authorization: Bearer <CRON_SECRET>   (Vercel la envía sola si la variable CRON_SECRET existe)
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "Falta la variable CRON_SECRET." }, { status: 503 });
  if (!safeEqual(req.headers.get("authorization") ?? "", `Bearer ${secret}`)) return Response.json({ error: "No autorizado." }, { status: 401 });
  const fx = await refreshCnyRate();
  if (!fx) return Response.json({ error: "No se pudo consultar el tipo de cambio." }, { status: 502 });
  return Response.json({ ok: true, ...fx });
}

/** Comparación en tiempo constante (sobre el hash, para no filtrar la longitud). */
function safeEqual(a: string, b: string) {
  const h = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(h(a), h(b));
}
