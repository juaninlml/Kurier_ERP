import { renderStatement } from "@/pdf/render";
import { pdfResponse } from "../../respond";
import { getLang } from "@/lib/i18n/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const download = new URL(req.url).searchParams.has("download");
  return pdfResponse(async () => renderStatement(id, await getLang()), download);
}
