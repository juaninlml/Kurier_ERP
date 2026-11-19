import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "./db";

export const ROLES = ["OWNER", "ADMIN", "USER"] as const;
export type Role = (typeof ROLES)[number];
export const canManageUsers = (role: string) => role === "OWNER" || role === "ADMIN";

/** Usuario con sesión activa (o redirige al login). */
export async function getCurrentUser() {
  const session = await auth();
  const id = Number(session?.user?.id);
  const user = id ? await prisma.user.findUnique({ where: { id } }) : null;
  if (!user || !user.active) redirect("/login");
  return user;
}

/** Solo la cuenta maestra y los administradores. */
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!canManageUsers(user.role)) throw new Error("Solo la cuenta maestra o un administrador puede hacer esto.");
  return user;
}
