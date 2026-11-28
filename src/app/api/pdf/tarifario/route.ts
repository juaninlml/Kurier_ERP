import { renderTariff } from "@/pdf/render";
import { pdfResponse } from "../respond";
import { getLang } from "@/lib/i18n/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const download = new URL(req.url).searchParams.has("download");
  return pdfResponse(async () => renderTariff(await getLang()), download);
}
