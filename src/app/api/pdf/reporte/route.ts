import { renderReport } from "@/pdf/render";
import { pdfResponse } from "../respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  return pdfResponse(() => renderReport(sp.get("from") ?? undefined, sp.get("to") ?? undefined), sp.has("download"));
}
