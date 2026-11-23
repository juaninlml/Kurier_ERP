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
    // El proxy usa esta configuración (sin base de datos): sin este callback la sesión del proxy no traía
    // el rol y los permisos por rol bloqueaban todo. El token ya trae uid y role (los pone src/auth.ts).
    session({ session, token }) {
      session.user.id = String(token.uid ?? "");
      session.user.role = String(token.role ?? "");
      return session;
    },
  },
} satisfies NextAuthConfig;
