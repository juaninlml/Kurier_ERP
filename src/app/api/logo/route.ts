import { prisma } from "@/lib/db";
import { requireApiUser } from "../pdf/respond";

export const dynamic = "force-dynamic";

/** Sirve el logo guardado en la base de datos (vista previa en Configuración). */
export async function GET(req: Request) {
  const denied = await requireApiUser();
  if (denied) return denied;
  const s = await prisma.companySettings.findUnique({ where: { id: 1 }, select: { logoData: true, logoMime: true } });
  if (!s?.logoData || !s.logoMime) return new Response("Sin logo", { status: 404 });
  return new Response(new Uint8Array(s.logoData), { headers: { "Content-Type": s.logoMime, "Cache-Control": cacheControl(req), "Content-Security-Policy": "default-src 'none'" } });
}

/** Con ?v=<fecha de cambio> la URL cambia cuando cambia el logo: el navegador puede guardarlo un año. */
function cacheControl(req: Request) {
  return new URL(req.url).searchParams.has("v") ? "private, max-age=31536000, immutable" : "private, max-age=60";
}
