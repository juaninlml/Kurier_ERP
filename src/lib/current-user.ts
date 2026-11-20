import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "./db";

export const ROLES = ["OWNER", "ADMIN", "USER"] as const;
export type Role = (typeof ROLES)[number];
export const canManageUsers = (role: string) => role === "OWNER" || role === "ADMIN";

/**
 * Sesión y usuario de la petición actual. Con `cache` se calculan una sola vez por petición
 * aunque los pidan el layout, la página y las acciones (antes eran varias consultas por clic).
 */
export const getSession = cache(() => auth());

export const getSessionUser = cache(async () => {
  const session = await getSession();
  const id = Number(session?.user?.id);
  if (!id) return null;
  const user = await prisma.user.findUnique({ where: { id } });
  return user?.active ? user : null;
});

/** Usuario con sesión activa (o redirige al login). */
export async function getCurrentUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Solo la cuenta maestra y los administradores. */
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!canManageUsers(user.role)) throw new Error("Solo la cuenta maestra o un administrador puede hacer esto.");
  return user;
}
