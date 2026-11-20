import NextAuth from "next-auth";
import authConfig from "./auth.config";

const { auth } = NextAuth(authConfig);

/**
 * Proxy de Next.js 16 (antes "middleware"): todo el ERP requiere iniciar sesión con correo + código
 * del autenticador (ver src/auth.ts). Corre en Node.js; solo valida la sesión (JWT), sin tocar la base.
 * Las rutas públicas y la redirección al login se deciden en `authorized` (src/auth.config.ts).
 * Quedan fuera: archivos estáticos y /api/wms (usa su propio token, WMS_API_TOKEN).
 */
export const proxy = auth;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|branding/|api/wms/).*)"],
};
