import { renderInvoice } from "@/pdf/render";
import { getLang } from "@/lib/i18n/server";
import { pdfResponse } from "../../respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Factura en PDF, en el idioma del usuario (español o inglés). ?download la descarga en lugar de abrirla. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const download = new URL(req.url).searchParams.has("download");
  return pdfResponse(renderInvoice(id, await getLang()), download);
}
