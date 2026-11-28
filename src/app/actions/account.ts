"use server";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { safe, safePublic } from "@/lib/safe-action";
import { prisma } from "@/lib/db";
import { getCurrentUser, requireAdmin, ROLES } from "@/lib/current-user";
import { ownerEmail, signIn, signOut } from "@/auth";
import { decryptSecret, safeEqual, verifyCode } from "@/lib/totp";
import { isLang, LANG_COOKIE } from "@/lib/i18n";
import { ARRIVE_COOKIE } from "@/lib/session-ui";
import { numv, str } from "./helpers";

const YEAR = 60 * 60 * 24 * 365;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const newToken = () => randomBytes(24).toString("base64url");
const validInvite = (i: { usedAt: Date | null; revokedAt: Date | null; expiresAt: Date } | null) => !!i && !i.usedAt && !i.revokedAt && i.expiresAt > new Date();

// ───────────── Inicio de sesión ─────────────

async function loginImpl(fd: FormData) {
  const email = str(fd, "email").toLowerCase();
  const code = str(fd, "code").replace(/\D/g, "");
  if (!email || code.length !== 6) throw new Error("Escribe tu correo y el código de 6 dígitos de tu app autenticadora.");
  const user = await prisma.user.findUnique({ where: { email } });
  const lockMsg = (u: { lockedUntil: Date | null } | null) => {
    if (u?.lockedUntil && u.lockedUntil > new Date()) {
      return "Demasiados intentos fallidos. La cuenta se bloqueó 15 minutos.";
    }
    return null;
  };
  const locked = lockMsg(user);
  if (locked) throw new Error(locked);
  // Marca de llegada: el ERP se abre con la cortina de entrada (solo la animación; no da acceso a nada).
  const jar = await cookies();
  jar.set(ARRIVE_COOKIE, "1", { maxAge: 60, path: "/", sameSite: "lax" });
  try {
    // Sin redirigir desde el servidor: el login primero cierra la cortina y luego abre el ERP (ver <Form session="in">).
    await signIn("totp", { email, code, redirect: false });
  } catch (e) {
    if (e instanceof AuthError) {
      jar.delete(ARRIVE_COOKIE);
      const again = await prisma.user.findUnique({ where: { email } });
      throw new Error(lockMsg(again) ?? "Correo o código incorrecto. Usa el código más reciente de tu app.");
    }
    throw e;
  }
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

// ───────────── Vincular el autenticador (link de invitación) ─────────────

/** Invitación sin correo: la persona escribe su nombre y correo antes de ver el QR. */
async function setInvitationIdentityImpl(token: string, fd: FormData) {
  const inv = await prisma.invitation.findUnique({ where: { token } });
  if (!validInvite(inv)) throw new Error("La invitación ya no es válida.");
  if (inv!.email) return;
  const email = str(fd, "email").toLowerCase();
  if (!EMAIL_RE.test(email)) throw new Error("Escribe un correo válido.");
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing?.active && existing.totpSecret) throw new Error("Ese correo ya tiene acceso. Si cambió de teléfono, pide un link para restablecer el autenticador.");
  await prisma.invitation.update({ where: { token }, data: { email, name: str(fd, "name") } });
  revalidatePath(`/invitacion/${token}`);
}

/** Confirma el primer código del QR: crea (o actualiza) el usuario con su autenticador. */
async function confirmEnrollmentImpl(token: string, fd: FormData) {
  const inv = await prisma.invitation.findUnique({ where: { token } });
  if (!validInvite(inv) || !inv!.email || !inv!.pendingSecret) throw new Error("La invitación ya no es válida.");
  const step = verifyCode(decryptSecret(inv!.pendingSecret), str(fd, "code"));
  if (step === null) throw new Error("El código no coincide. Revisa que la hora de tu teléfono sea automática y escribe el código actual.");
  const email = inv!.email.toLowerCase();
  const name = str(fd, "name") || inv!.name;
  if (inv!.kind === "OWNER" && email !== ownerEmail()) throw new Error("La cuenta maestra cambió. Genera un nuevo link de configuración.");
  const existing = await prisma.user.findUnique({ where: { email } });
  if (inv!.kind === "RESET" && !existing) throw new Error("El usuario ya no existe.");
  const auth = { totpSecret: inv!.pendingSecret, totpLastStep: step, failedLogins: 0, lockedUntil: null };
  const role = inv!.kind === "OWNER" ? "OWNER" : inv!.kind === "RESET" ? existing!.role : inv!.role;

  await prisma.$transaction([
    existing
      ? prisma.user.update({ where: { id: existing.id }, data: { ...auth, active: true, role, ...(name && !existing.name ? { name } : {}) } })
      : prisma.user.create({ data: { ...auth, email, name, role, invitedById: inv!.createdById } }),
    prisma.invitation.update({ where: { id: inv!.id }, data: { usedAt: new Date(), usedByEmail: email, pendingSecret: "" } }),
  ]);
  redirect(`/login?vinculado=1&email=${encodeURIComponent(email)}`);
}

/** Cuenta maestra: con la clave de instalación (ERP_SETUP_KEY) se genera su link para vincular el autenticador. */
async function startOwnerSetupImpl(fd: FormData) {
  const owner = ownerEmail();
  const setupKey = process.env.ERP_SETUP_KEY ?? "";
  if (!owner || !setupKey) throw new Error("Faltan ERP_OWNER_EMAIL o ERP_SETUP_KEY en las variables de entorno.");
  if (!safeEqual(str(fd, "setupKey"), setupKey)) {
    await new Promise((r) => setTimeout(r, 1200)); // frena intentos repetidos
    throw new Error("La clave de instalación no es correcta.");
  }
  const token = newToken();
  await prisma.invitation.create({ data: { token, email: owner, role: "OWNER", kind: "OWNER", expiresAt: new Date(Date.now() + 60 * 60000) } });
  redirect(`/invitacion/${token}`);
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
  if (email && !EMAIL_RE.test(email)) throw new Error("Correo inválido.");
  if (email && (await prisma.user.findFirst({ where: { email, active: true, NOT: { totpSecret: "" } } }))) throw new Error("Ese correo ya tiene acceso.");
  const days = Math.min(30, Math.max(1, Math.round(numv(fd, "days", 7))));
  await prisma.invitation.create({
    data: { token: newToken(), email, role, note: str(fd, "note"), expiresAt: new Date(Date.now() + days * 86400000), createdById: admin.id },
  });
  revalidatePath("/usuarios");
}

/** Link para que un usuario vincule un teléfono nuevo (su autenticador actual sigue funcionando hasta que lo use). */
async function createResetLinkImpl(userId: number) {
  const admin = await requireAdmin();
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (u.role === "OWNER") throw new Error("La cuenta maestra se restablece desde /configurar-acceso con la clave de instalación.");
  if (u.role === "ADMIN" && admin.role !== "OWNER") throw new Error("Solo la cuenta maestra puede restablecer administradores.");
  await prisma.invitation.updateMany({ where: { email: u.email, kind: "RESET", usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
  await prisma.invitation.create({
    data: { token: newToken(), email: u.email, role: u.role, kind: "RESET", note: "Restablecer autenticador", expiresAt: new Date(Date.now() + 3 * 86400000), createdById: admin.id },
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
  if (!(ROLES as readonly string[]).includes(role) || role === "OWNER") throw new Error("Rol inválido.");
  if ((role === "ADMIN" || target.role === "ADMIN") && admin.role !== "OWNER") throw new Error("Solo la cuenta maestra puede cambiar administradores.");
  const active = fd.get("active") === "on";
  await prisma.user.update({ where: { id }, data: { role, active, ...(fd.get("unlock") === "on" ? { failedLogins: 0, lockedUntil: null } : {}) } });
  // Al desactivar, sus links pendientes (p. ej. "restablecer autenticador") dejan de servir: si no, al usarlo se reactivaría solo
  if (!active) await prisma.invitation.updateMany({ where: { email: target.email, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
  revalidatePath("/usuarios");
}

export const login = safePublic(loginImpl);
export const setInvitationIdentity = safePublic(setInvitationIdentityImpl);
export const confirmEnrollment = safePublic(confirmEnrollmentImpl);
export const startOwnerSetup = safePublic(startOwnerSetupImpl);
export const setLanguage = safePublic(setLanguageImpl);
export const updateProfile = safe(updateProfileImpl, "perfil", "updateProfileImpl");
export const createInvitation = safe(createInvitationImpl, "usuarios", "createInvitationImpl");
export const createResetLink = safe(createResetLinkImpl, "usuarios", "createResetLinkImpl");
export const revokeInvitation = safe(revokeInvitationImpl, "usuarios", "revokeInvitationImpl");
export const updateUser = safe(updateUserImpl, "usuarios", "updateUserImpl");
