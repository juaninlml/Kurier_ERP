import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import authConfig, { isPublicPath } from "./auth.config";
import { canOpen } from "./lib/permissions";

const { auth } = NextAuth(authConfig);

const isDev = process.env.NODE_ENV !== "production";

/**
 * Content-Security-Policy con nonce por petición: solo se ejecutan los scripts que llevan el nonce
 * (los de Next.js lo reciben solos al leer esta cabecera; el del tema lo toma en src/app/layout.tsx).
 * Los estilos sí permiten 'unsafe-inline' porque React y Radix usan atributos style.
 */
function contentSecurityPolicy(nonce: string) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    // https: para la foto de perfil (puede venir de otro dominio); data:/blob: para vistas previas
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self'${isDev ? " ws:" : ""}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

/**
 * Proxy de Next.js 16 (antes "middleware"): todo el ERP requiere iniciar sesión con correo + código
 * del autenticador (ver src/auth.ts). Corre en Node.js; solo valida la sesión (JWT), sin tocar la base.
 * Las rutas públicas se definen en src/auth.config.ts. Además agrega la CSP a las páginas.
 * Quedan fuera: archivos estáticos y /api/wms (usa su propio token, WMS_API_TOKEN).
 */
export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  // Al pasar una función a auth(), Auth.js ya no redirige solo: se hace aquí, igual que antes
  if (!req.auth?.user && !isPublicPath(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("callbackUrl", req.nextUrl.href);
    return NextResponse.redirect(url);
  }
  // Permisos por rol: una sección que el rol no puede consultar regresa al Inicio (un PDF responde 403)
  const role = String(req.auth?.user?.role ?? "");
  if (req.auth?.user && !isPublicPath(pathname) && !canOpen(role, pathname)) {
    if (pathname.startsWith("/api/")) return new NextResponse("Sin permiso", { status: 403 });
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "?sinpermiso=1";
    return NextResponse.redirect(url);
  }
  // Las respuestas de /api (PDFs, logos) no son HTML: no necesitan CSP
  if (pathname.startsWith("/api/")) return NextResponse.next();

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|branding/|kiosco-sw.js|api/wms/).*)"],
};
