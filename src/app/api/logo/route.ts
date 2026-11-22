import { prisma } from "@/lib/db";
import { requireApiUser } from "../pdf/respond";

export const dynamic = "force-dynamic";

/** Sirve el logo guardado en la base de datos (vista previa en Configuración). */
export async function GET() {
  const denied = await requireApiUser();
  if (denied) return denied;
  const s = await prisma.companySettings.findUnique({ where: { id: 1 }, select: { logoData: true, logoMime: true } });
  if (!s?.logoData || !s.logoMime) return new Response("Sin logo", { status: 404 });
  return new Response(new Uint8Array(s.logoData), { headers: { "Content-Type": s.logoMime, "Cache-Control": "private, max-age=60", "Content-Security-Policy": "default-src 'none'" } });
}
