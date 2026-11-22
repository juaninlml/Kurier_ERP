import { renderOrdersSummary } from "@/pdf/render";
import { DATE_RE, companyToday, weekOf } from "@/lib/orders";
import { pdfResponse } from "../../respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** /api/pdf/ordenes/12?desde=2026-11-16&hasta=2026-11-22 (por defecto, la semana actual). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const q = new URL(req.url).searchParams;
  let from = q.get("desde") ?? "";
  let to = q.get("hasta") ?? "";
  if (!DATE_RE.test(from) || !DATE_RE.test(to) || from > to) ({ from, to } = weekOf(await companyToday()));
  return pdfResponse(() => renderOrdersSummary(id, from, to), q.has("download"));
}
