import { renderTariff } from "@/pdf/render";
import { pdfResponse } from "../respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const download = new URL(req.url).searchParams.has("download");
  return pdfResponse(renderTariff(), download);
}
