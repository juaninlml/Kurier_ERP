import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Logo de una marca adicional (vista previa en Configuración). */
export async function GET(_req: Request, { params }: { params: Promise<{ brand: string }> }) {
  const id = Number((await params).brand);
  const b = id ? await prisma.brand.findUnique({ where: { id }, select: { logoData: true, logoMime: true } }) : null;
  if (!b?.logoData || !b.logoMime) return new Response("Sin logo", { status: 404 });
  return new Response(new Uint8Array(b.logoData), { headers: { "Content-Type": b.logoMime, "Cache-Control": "private, max-age=60" } });
}
