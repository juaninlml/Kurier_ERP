import { renderShipmentLabel } from "@/pdf/render";
import { pdfResponse } from "../../respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Guía de última milla: /api/pdf/guia/{id} (4 × 6 para térmica) o ?formato=carta (hoja carta con líneas de corte). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const url = new URL(req.url);
  return pdfResponse(() => renderShipmentLabel(id, url.searchParams.get("formato") === "carta"), url.searchParams.has("download"));
}
