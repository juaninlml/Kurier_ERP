import { NextResponse, type NextRequest } from "next/server";

/**
 * Protección básica de todo el ERP con usuario/contraseña (HTTP Basic Auth).
 * Configura ERP_USER y ERP_PASSWORD en las variables de entorno de Vercel.
 * En desarrollo local, si no están definidas, no se pide contraseña.
 */
export function middleware(req: NextRequest) {
  const user = process.env.ERP_USER;
  const pass = process.env.ERP_PASSWORD;

  if (!user || !pass) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("Falta configurar ERP_USER y ERP_PASSWORD en las variables de entorno.", { status: 503 });
    }
    return NextResponse.next();
  }

  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    try {
      const [u, ...rest] = atob(header.slice(6)).split(":");
      if (safeEqual(u, user) && safeEqual(rest.join(":"), pass)) return NextResponse.next();
    } catch {
      // encabezado mal formado → pedir credenciales de nuevo
    }
  }
  return new NextResponse("Autenticación requerida", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Kurier ERP", charset="UTF-8"' },
  });
}

/** Comparación en tiempo constante para no filtrar la contraseña por tiempos de respuesta. */
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const config = {
  // /api/wms usa su propio token (WMS_API_TOKEN), no la contraseña del ERP.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/wms/).*)"],
};
