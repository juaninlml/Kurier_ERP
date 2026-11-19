import NextAuth from "next-auth";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import authConfig from "./auth.config";

export const INVITE_COOKIE = "kurier_invite";
const RECHECK_MS = 5 * 60 * 1000;

/** Correo de la cuenta maestra (dueño). Se define en la variable de entorno ERP_OWNER_EMAIL. */
export const ownerEmail = () => (process.env.ERP_OWNER_EMAIL ?? "").trim().toLowerCase();

declare module "next-auth" {
  interface Session {
    user: { id: string; email: string; name?: string | null; image?: string | null; role: string; locale: string };
  }
}

/**
 * Quién puede entrar:
 *  1. La cuenta maestra (ERP_OWNER_EMAIL) → se crea como OWNER.
 *  2. Un usuario ya registrado y activo.
 *  3. Alguien que llega con un link de invitación vigente (y, si la invitación tiene correo, con ese correo).
 */
async function allowSignIn(email: string, name: string, image: string) {
  const now = new Date();
  if (email === ownerEmail()) {
    await prisma.user.upsert({
      where: { email },
      create: { email, name, image, role: "OWNER", lastLoginAt: now },
      update: { role: "OWNER", active: true, lastLoginAt: now, ...(name ? { name } : {}), ...(image ? { image } : {}) },
    });
    return true;
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing?.active) {
    await prisma.user.update({ where: { id: existing.id }, data: { lastLoginAt: now, ...(image ? { image } : {}), ...(!existing.name && name ? { name } : {}) } });
    return true;
  }

  const store = await cookies();
  const token = store.get(INVITE_COOKIE)?.value;
  if (!token) return "/login?error=NoAccess";
  const inv = await prisma.invitation.findUnique({ where: { token } });
  if (!inv || inv.usedAt || inv.revokedAt || inv.expiresAt < now) return "/login?error=InviteInvalid";
  if (inv.email && inv.email.toLowerCase() !== email) return "/login?error=InviteEmail";

  await prisma.$transaction([
    existing
      ? prisma.user.update({ where: { id: existing.id }, data: { active: true, role: inv.role, lastLoginAt: now, invitedById: inv.createdById } })
      : prisma.user.create({ data: { email, name, image, role: inv.role, lastLoginAt: now, invitedById: inv.createdById } }),
    prisma.invitation.update({ where: { id: inv.id }, data: { usedAt: now, usedByEmail: email } }),
  ]);
  store.delete(INVITE_COOKIE);
  return true;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account, profile }) {
      const email = (user.email ?? "").trim().toLowerCase();
      if (!email) return "/login?error=NoAccess";
      if (account?.provider === "google" && profile && profile.email_verified === false) return "/login?error=NoAccess";
      return allowSignIn(email, user.name ?? "", user.image ?? "");
    },
    async jwt({ token, user }) {
      const email = String(user?.email ?? token.email ?? "").toLowerCase();
      // Al iniciar sesión y cada pocos minutos se revisa el usuario en la base (por si fue desactivado o cambió su rol)
      if (user || !token.checkedAt || Date.now() - Number(token.checkedAt) > RECHECK_MS) {
        const u = email ? await prisma.user.findUnique({ where: { email } }) : null;
        if (!u || !u.active) return null;
        token.uid = String(u.id);
        token.role = u.role;
        token.locale = u.locale;
        token.name = u.name || token.name;
        token.picture = u.image || token.picture;
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
