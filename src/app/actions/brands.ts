"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { safe } from "@/lib/safe-action";
import { requireAdmin } from "@/lib/current-user";
import { readLogo, str } from "./helpers";

const HEX = /^#[0-9a-fA-F]{6}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function brandData(fd: FormData) {
  const tradeName = str(fd, "tradeName");
  if (!tradeName) throw new Error("Escribe el nombre comercial de la marca.");
  const primaryColor = str(fd, "primaryColor") || "#1F4E79";
  const accentColor = str(fd, "accentColor") || "#ED7D31";
  if (!HEX.test(primaryColor) || !HEX.test(accentColor)) throw new Error("Los colores deben ser hex de 6 dígitos (#RRGGBB).");
  const email = str(fd, "email");
  if (email && !EMAIL.test(email)) throw new Error("El correo de la marca no es válido.");

  // Logo en la base de datos (en Vercel el disco es de solo lectura), igual que el de la principal.
  let logo: { logoData: Uint8Array<ArrayBuffer> | null; logoMime: string } | undefined;
  const file = fd.get("logo");
  if (fd.get("removeLogo") === "on") logo = { logoData: null, logoMime: "" };
  else if (file instanceof File && file.size > 0) {
    logo = await readLogo(file);
  }
  return {
    tradeName,
    tagline: str(fd, "tagline"),
    legalName: str(fd, "legalName"),
    rfc: str(fd, "rfc").toUpperCase(),
    address: str(fd, "address"),
    city: str(fd, "city"),
    state: str(fd, "state"),
    zip: str(fd, "zip"),
    phone: str(fd, "phone"),
    email,
    website: str(fd, "website"),
    bankName: str(fd, "bankName"),
    bankAccount: str(fd, "bankAccount"),
    clabe: str(fd, "clabe"),
    primaryColor,
    accentColor,
    quotePrefix: str(fd, "quotePrefix").toUpperCase(),
    invoicePrefix: str(fd, "invoicePrefix").toUpperCase(),
    ...(logo ?? {}),
  };
}

const refresh = () => {
  revalidatePath("/configuracion");
  revalidatePath("/clientes", "layout");
};

async function createBrandImpl(fd: FormData) {
  await requireAdmin();
  await prisma.brand.create({ data: await brandData(fd) });
  refresh();
}

async function updateBrandImpl(id: number, fd: FormData) {
  await requireAdmin();
  await prisma.brand.update({ where: { id }, data: { ...(await brandData(fd)), active: fd.get("active") !== "off" } });
  refresh();
}

export const createBrand = safe(createBrandImpl, "configuracion", "createBrandImpl");
export const updateBrand = safe(updateBrandImpl, "configuracion", "updateBrandImpl");
