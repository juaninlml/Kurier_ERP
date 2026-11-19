import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

/** Rutas que no requieren sesión. */
const PUBLIC_PATHS = ["/login", "/invitacion", "/api/auth"];
export const isPublicPath = (pathname: string) => PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/** Acceso de prueba SOLO en desarrollo local (AUTH_DEV_LOGIN=1). Nunca se activa en producción. */
export const devLoginEnabled = process.env.NODE_ENV !== "production" && process.env.AUTH_DEV_LOGIN === "1";

/**
 * Configuración compatible con el middleware (edge): proveedores y regla de acceso a rutas.
 * Las reglas de quién puede entrar (cuenta maestra, usuarios e invitaciones) están en src/auth.ts.
 */
export default {
  providers: [
    Google({ authorization: { params: { prompt: "select_account" } } }),
    ...(devLoginEnabled
      ? [
          Credentials({
            id: "dev",
            name: "Desarrollo",
            credentials: { email: { label: "Correo", type: "email" } },
            authorize: (c) => {
              const email = String(c?.email ?? "").trim().toLowerCase();
              return email ? { id: email, email, name: email.split("@")[0] } : null;
            },
          }),
        ]
      : []),
  ],
  pages: { signIn: "/login", error: "/login" },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  trustHost: true,
  callbacks: {
    authorized({ auth, request }) {
      if (isPublicPath(request.nextUrl.pathname)) return true;
      return !!auth?.user;
    },
  },
} satisfies NextAuthConfig;
