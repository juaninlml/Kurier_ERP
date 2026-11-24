import { renderStorageLabels } from "@/pdf/render";
import { pdfResponse } from "../respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Etiquetas de almacenamiento (4 × 6): /api/pdf/almacenamiento?id=3 para una, sin id para todas las activas. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id")) || undefined;
  return pdfResponse(() => renderStorageLabels(id), url.searchParams.has("download"));
}
