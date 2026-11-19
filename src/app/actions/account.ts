"use server";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { safe } from "@/lib/safe-action";
import { prisma } from "@/lib/db";
import { getCurrentUser, requireAdmin, ROLES } from "@/lib/current-user";
import { INVITE_COOKIE, signIn, signOut } from "@/auth";
import { devLoginEnabled } from "@/auth.config";
import { isLang, LANG_COOKIE } from "@/lib/i18n";
import { numv, str } from "./helpers";

const YEAR = 60 * 60 * 24 * 365;

// ───────────── Sesión ─────────────

export async function signInWithGoogle(fd: FormData) {
  const next = str(fd, "next");
  await signIn("google", { redirectTo: next.startsWith("/") && !next.startsWith("//") ? next : "/" });
}

/** Desde el link de invitación: guarda el token y manda a Google. */
export async function acceptInvitation(token: string) {
  const inv = await prisma.invitation.findUnique({ where: { token } });
  if (!inv || inv.usedAt || inv.revokedAt || inv.expiresAt < new Date()) throw new Error("La invitación ya no es válida.");
  (await cookies()).set(INVITE_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 30, path: "/" });
  await signIn("google", { redirectTo: "/perfil?bienvenida=1" });
}

/** Solo desarrollo local (AUTH_DEV_LOGIN=1): entrar con un correo sin Google. */
export async function devSignIn(fd: FormData) {
  if (!devLoginEnabled) throw new Error("No disponible.");
  await signIn("dev", { email: str(fd, "email"), redirectTo: "/" });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

// ───────────── Idioma y perfil ─────────────

async function setLanguageImpl(lang: string) {
  if (!isLang(lang)) throw new Error("Idioma inválido.");
  (await cookies()).set(LANG_COOKIE, lang, { sameSite: "lax", maxAge: YEAR, path: "/" });
  const user = await getCurrentUser().catch(() => null);
  if (user) await prisma.user.update({ where: { id: user.id }, data: { locale: lang } });
  revalidatePath("/", "layout");
}

async function updateProfileImpl(fd: FormData) {
  const user = await getCurrentUser();
  const lang = str(fd, "locale");
  await prisma.user.update({
    where: { id: user.id },
    data: { name: str(fd, "name"), position: str(fd, "position"), phone: str(fd, "phone"), ...(isLang(lang) ? { locale: lang } : {}) },
  });
  if (isLang(lang)) (await cookies()).set(LANG_COOKIE, lang, { sameSite: "lax", maxAge: YEAR, path: "/" });
  revalidatePath("/", "layout");
}

// ───────────── Usuarios e invitaciones ─────────────

async function createInvitationImpl(fd: FormData) {
  const admin = await requireAdmin();
  const role = str(fd, "role") || "USER";
  if (!(ROLES as readonly string[]).includes(role) || role === "OWNER") throw new Error("Rol inválido.");
  if (role === "ADMIN" && admin.role !== "OWNER") throw new Error("Solo la cuenta maestra puede invitar administradores.");
  const email = str(fd, "email").toLowerCase();
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Correo inválido.");
  if (email && (await prisma.user.findFirst({ where: { email, active: true } }))) throw new Error("Ese correo ya tiene acceso.");
  const days = Math.min(30, Math.max(1, Math.round(numv(fd, "days", 7))));
  await prisma.invitation.create({
    data: {
      token: randomBytes(24).toString("base64url"),
      email,
      role,
      note: str(fd, "note"),
      expiresAt: new Date(Date.now() + days * 86400000),
      createdById: admin.id,
    },
  });
  revalidatePath("/usuarios");
}

async function revokeInvitationImpl(id: number) {
  await requireAdmin();
  await prisma.invitation.update({ where: { id }, data: { revokedAt: new Date() } });
  revalidatePath("/usuarios");
}

async function updateUserImpl(id: number, fd: FormData) {
  const admin = await requireAdmin();
  const target = await prisma.user.findUniqueOrThrow({ where: { id } });
  if (target.role === "OWNER") throw new Error("La cuenta maestra no se puede modificar.");
  if (target.id === admin.id) throw new Error("No puedes cambiar tu propio acceso.");
  const role = str(fd, "role");
  if (!["ADMIN", "USER"].includes(role)) throw new Error("Rol inválido.");
  if ((role === "ADMIN" || target.role === "ADMIN") && admin.role !== "OWNER") throw new Error("Solo la cuenta maestra puede cambiar administradores.");
  await prisma.user.update({ where: { id }, data: { role, active: fd.get("active") === "on" } });
  revalidatePath("/usuarios");
}

export const setLanguage = safe(setLanguageImpl);
export const updateProfile = safe(updateProfileImpl);
export const createInvitation = safe(createInvitationImpl);
export const revokeInvitation = safe(revokeInvitationImpl);
export const updateUser = safe(updateUserImpl);
