import { renderGoodsExit } from "@/pdf/render";
import { pdfResponse } from "../../respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Hoja de salida de mercancía: /api/pdf/salida/{id} · formato en blanco: /api/pdf/salida/blanco */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const raw = (await params).id;
  const id = raw === "blanco" ? null : Number(raw);
  if (id !== null && !Number.isInteger(id)) return new Response("No encontrado", { status: 404 });
  return pdfResponse(() => renderGoodsExit(id), new URL(req.url).searchParams.has("download"));
}
