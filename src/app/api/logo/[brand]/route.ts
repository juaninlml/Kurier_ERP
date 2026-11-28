import { prisma } from "@/lib/db";
import { requireApiUser } from "../../pdf/respond";

export const dynamic = "force-dynamic";

/** Logo de una marca adicional (vista previa en Configuración). */
export async function GET(req: Request, { params }: { params: Promise<{ brand: string }> }) {
  const denied = await requireApiUser();
  if (denied) return denied;
  const id = Number((await params).brand);
  const b = id ? await prisma.brand.findUnique({ where: { id }, select: { logoData: true, logoMime: true } }) : null;
  if (!b?.logoData || !b.logoMime) return new Response("Sin logo", { status: 404 });
  return new Response(new Uint8Array(b.logoData), { headers: { "Content-Type": b.logoMime, "Cache-Control": cacheControl(req), "Content-Security-Policy": "default-src 'none'" } });
}

/** Con ?v=<fecha de cambio> la URL cambia cuando cambia el logo: el navegador puede guardarlo un año. */
function cacheControl(req: Request) {
  return new URL(req.url).searchParams.has("v") ? "private, max-age=31536000, immutable" : "private, max-age=60";
}
