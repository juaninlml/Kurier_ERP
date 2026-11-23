import { createHash, timingSafeEqual } from "node:crypto";
import { ZodError } from "zod";
import { saveStatement } from "@/lib/wms/imports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Recibe estados de cobro desde el WMS.
 *   POST /api/wms/statements
 *   Authorization: Bearer <WMS_API_TOKEN>
 *   Body: WmsStatement (ver src/lib/wms/types.ts) o { statements: WmsStatement[] }
 * Cada estado queda "pendiente" en Facturas → Importar del WMS para revisarlo antes de facturar.
 */
export async function POST(req: Request) {
  const token = process.env.WMS_API_TOKEN;
  if (!token) return Response.json({ error: "La API del WMS no está habilitada (falta WMS_API_TOKEN)." }, { status: 503 });
  const auth = req.headers.get("authorization") ?? "";
  if (!safeEqual(auth, `Bearer ${token}`)) return Response.json({ error: "No autorizado." }, { status: 401 });

  // Vercel corta en 4.5 MB; se rechaza antes de leer si el WMS declara más
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY) return Response.json({ error: "El envío pesa más de 4 MB." }, { status: 413 });
  let body: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY) return Response.json({ error: "El envío pesa más de 4 MB." }, { status: 413 });
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "El cuerpo debe ser JSON." }, { status: 400 });
  }
  const list = Array.isArray((body as { statements?: unknown[] })?.statements) ? (body as { statements: unknown[] }).statements : [body];
  if (list.length > 100) return Response.json({ error: "Máximo 100 estados por envío." }, { status: 413 });

  const results = [];
  for (const st of list) {
    try {
      const imp = await saveStatement(st, "api");
      results.push({ folio: imp.folio, id: imp.id, status: imp.status, clientMatched: imp.clientId !== null });
    } catch (e) {
      results.push({
        folio: (st as { folio?: string })?.folio ?? null,
        error: e instanceof ZodError ? e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") : e instanceof Error ? e.message : "Error",
      });
    }
  }
  const failed = results.filter((r) => "error" in r).length;
  return Response.json({ received: list.length, saved: list.length - failed, results }, { status: failed === list.length ? 422 : 200 });
}

const MAX_BODY = 4 * 1024 * 1024;

/** Comparación en tiempo constante; con hash para no revelar ni la longitud del token. */
function safeEqual(a: string, b: string) {
  const h = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(h(a), h(b));
}
