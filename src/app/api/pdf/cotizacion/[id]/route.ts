import { renderQuote } from "@/pdf/render";
import { pdfResponse } from "../../respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const download = new URL(req.url).searchParams.has("download");
  return pdfResponse(await renderQuote(id), download);
}
