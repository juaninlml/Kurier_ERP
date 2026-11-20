import type { NextAuthConfig } from "next-auth";

/** Rutas que no requieren sesión. */
const PUBLIC_PATHS = ["/login", "/invitacion", "/configurar-acceso", "/kiosco", "/api/auth"];
export const isPublicPath = (pathname: string) => PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/**
 * Configuración del proxy (src/proxy.ts): solo valida la sesión, sin consultar la base.
 * El inicio de sesión (correo + código del autenticador) está en src/auth.ts.
 */
export default {
  providers: [],
  pages: { signIn: "/login", error: "/login" },
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 }, // la sesión dura 12 horas
  trustHost: true,
  callbacks: {
    authorized({ auth, request }) {
      if (isPublicPath(request.nextUrl.pathname)) return true;
      return !!auth?.user;
    },
  },
} satisfies NextAuthConfig;
