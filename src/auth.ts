import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import { decryptSecret, verifyCode } from "@/lib/totp";
import authConfig from "./auth.config";

const RECHECK_MS = 5 * 60 * 1000;
export const MAX_FAILED = 5;
export const LOCK_MINUTES = 15;

/** Correo de la cuenta maestra (dueño). Se define en la variable de entorno ERP_OWNER_EMAIL. */
export const ownerEmail = () => (process.env.ERP_OWNER_EMAIL ?? "").trim().toLowerCase();

declare module "next-auth" {
  interface Session {
    user: { id: string; email: string; name?: string | null; image?: string | null; role: string; locale: string };
  }
}

/**
 * Valida correo + código del autenticador. Bloquea la cuenta 15 min tras 5 códigos incorrectos
 * y no acepta dos veces el mismo código.
 */
export async function authorizeTotp(emailRaw: unknown, codeRaw: unknown) {
  const email = String(emailRaw ?? "").trim().toLowerCase();
  const code = String(codeRaw ?? "");
  if (!email || !code) return null;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active || !user.totpSecret) return null;
  const now = new Date();
  if (user.lockedUntil && user.lockedUntil > now) return null;

  let step: number | null = null;
  try {
    step = verifyCode(decryptSecret(user.totpSecret), code, user.totpLastStep);
  } catch {
    step = null;
  }
  if (step === null) {
    const failed = user.failedLogins + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: failed >= MAX_FAILED ? { failedLogins: 0, lockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60000) } : { failedLogins: failed },
    });
    return null;
  }
  await prisma.user.update({ where: { id: user.id }, data: { totpLastStep: step, failedLogins: 0, lockedUntil: null, lastLoginAt: now } });
  return { id: String(user.id), email: user.email, name: user.name || user.email };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      id: "totp",
      name: "Autenticador",
      credentials: { email: { label: "Correo", type: "email" }, code: { label: "Código", type: "text" } },
      authorize: (c) => authorizeTotp(c?.email, c?.code),
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      const email = String(user?.email ?? token.email ?? "").toLowerCase();
      // Al iniciar sesión y cada pocos minutos se revisa el usuario (por si fue desactivado o cambió su rol)
      if (user || !token.checkedAt || Date.now() - Number(token.checkedAt) > RECHECK_MS) {
        const u = email ? await prisma.user.findUnique({ where: { email } }) : null;
        if (!u || !u.active || !u.totpSecret) return null;
        token.uid = String(u.id);
        token.role = u.role;
        token.locale = u.locale;
        token.name = u.name || u.email;
        token.picture = u.image || null;
        token.checkedAt = Date.now();
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = String(token.uid ?? "");
      session.user.role = String(token.role ?? "USER");
      session.user.locale = String(token.locale ?? "es");
      return session;
    },
  },
});
