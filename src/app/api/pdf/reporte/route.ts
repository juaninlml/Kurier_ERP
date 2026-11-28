import { renderReport } from "@/pdf/render";
import { pdfResponse } from "../respond";
import { getLang } from "@/lib/i18n/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  return pdfResponse(async () => renderReport(sp.get("from") ?? undefined, sp.get("to") ?? undefined, await getLang()), sp.has("download"));
}
