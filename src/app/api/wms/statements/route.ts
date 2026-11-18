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

  let body: unknown;
  try {
    body = await req.json();
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

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
