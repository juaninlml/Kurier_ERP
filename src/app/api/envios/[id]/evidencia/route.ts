import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Evidencia de entrega: /api/envios/{id}/evidencia?tipo=foto | firma (requiere sesión con acceso a Envíos). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const kind = new URL(req.url).searchParams.get("tipo") === "firma" ? "firma" : "foto";
  const p = await prisma.shipmentProof.findUnique({
    where: { shipmentId: id },
    select: kind === "firma" ? { signature: true, signatureMime: true } : { photo: true, photoMime: true },
  });
  const bytes = p ? (kind === "firma" ? (p as { signature: Uint8Array }).signature : (p as { photo: Uint8Array }).photo) : null;
  if (!bytes) return new Response("No encontrado", { status: 404 });
  const mime = kind === "firma" ? (p as { signatureMime: string }).signatureMime : (p as { photoMime: string }).photoMime;
  return new Response(new Uint8Array(bytes), { headers: { "Content-Type": mime, "Cache-Control": "private, max-age=3600" } });
}
