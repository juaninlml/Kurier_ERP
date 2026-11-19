import type { NextAuthConfig } from "next-auth";

/** Rutas que no requieren sesión. */
const PUBLIC_PATHS = ["/login", "/invitacion", "/configurar-acceso", "/api/auth"];
export const isPublicPath = (pathname: string) => PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/**
 * Configuración compatible con el middleware (edge): solo valida la sesión.
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
