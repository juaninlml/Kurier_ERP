import { renderIncident } from "@/pdf/render";
import { pdfResponse } from "../../respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Formato de una incidencia: /api/pdf/incidencia/{id} (vacaciones, permiso, falta o descanso por retardos). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const url = new URL(req.url);
  return pdfResponse(renderIncident(id), url.searchParams.has("download"));
}
