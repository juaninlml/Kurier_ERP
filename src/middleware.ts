import NextAuth from "next-auth";
import authConfig from "./auth.config";

/**
 * Todo el ERP requiere iniciar sesión con correo + código del autenticador (ver src/auth.ts).
 * Quedan fuera: archivos estáticos y /api/wms (usa su propio token, WMS_API_TOKEN).
 */
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|branding/|api/wms/).*)"],
};
