import { renderPayrollReceipts } from "@/pdf/render";
import { pdfResponse } from "../../respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Recibos de nómina: /api/pdf/nomina/{runId} (todos) o ?linea={lineId} (uno). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const url = new URL(req.url);
  const line = Number(url.searchParams.get("linea")) || undefined;
  return pdfResponse(() => renderPayrollReceipts(id, line), url.searchParams.has("download"));
}
