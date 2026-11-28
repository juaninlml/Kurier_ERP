import { renderShipmentLabel } from "@/pdf/render";
import { pdfResponse } from "../../respond";
import { getLang } from "@/lib/i18n/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Guía de última milla: /api/pdf/guia/{id} (4 × 6 para térmica) o ?formato=carta (hoja carta con líneas de corte). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const url = new URL(req.url);
  return pdfResponse(async () => renderShipmentLabel(id, url.searchParams.get("formato") === "carta", url.origin, await getLang()), url.searchParams.has("download"));
}
