"use server";

import { safe } from "@/lib/safe-action";
import { requireAdmin } from "@/lib/current-user";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { numv, readLogo, str } from "./helpers";

const HEX = /^#[0-9a-fA-F]{6}$/;

async function saveSettingsImpl(fd: FormData) {
  // Datos bancarios (CLABE), folios y marca de todos los PDFs: solo la cuenta maestra o un administrador
  await requireAdmin();
  const primaryColor = str(fd, "primaryColor");
  const accentColor = str(fd, "accentColor");
  if (!HEX.test(primaryColor) || !HEX.test(accentColor)) throw new Error("Los colores deben ser hex de 6 dígitos (#RRGGBB).");

  // El logo se guarda en la base de datos (en Vercel el disco es de solo lectura).
  let logo: { logoData: Uint8Array<ArrayBuffer> | null; logoMime: string } | undefined;
  const file = fd.get("logo");
  if (fd.get("removeLogo") === "on") {
    logo = { logoData: null, logoMime: "" };
  } else if (file instanceof File && file.size > 0) {
    logo = await readLogo(file);
  }

  const data = {
    tradeName: str(fd, "tradeName") || "Kurier Fulfillment",
    tagline: str(fd, "tagline"),
    paymentTerms: str(fd, "paymentTerms"),
    invoiceDisclaimer: str(fd, "invoiceDisclaimer"),
    legalName: str(fd, "legalName"),
    rfc: str(fd, "rfc").toUpperCase(),
    address: str(fd, "address"),
    city: str(fd, "city"),
    state: str(fd, "state"),
    zip: str(fd, "zip"),
    phone: str(fd, "phone"),
    email: str(fd, "email"),
    website: str(fd, "website"),
    bankName: str(fd, "bankName"),
    bankAccount: str(fd, "bankAccount"),
    clabe: str(fd, "clabe"),
    primaryColor,
    accentColor,
    quotePrefix: str(fd, "quotePrefix") || "COT",
    invoicePrefix: str(fd, "invoicePrefix") || "FAC",
    nextQuoteNumber: Math.max(1, Math.floor(numv(fd, "nextQuoteNumber", 1))),
    nextInvoiceNumber: Math.max(1, Math.floor(numv(fd, "nextInvoiceNumber", 1))),
    defaultTaxRate: numv(fd, "defaultTaxRate", 16),
    quoteValidityDays: Math.floor(numv(fd, "quoteValidityDays", 15)),
    paymentTermsDays: Math.floor(numv(fd, "paymentTermsDays", 30)),
    quoteTerms: str(fd, "quoteTerms"),
    invoiceNotes: str(fd, "invoiceNotes"),
    ...(logo ?? {}),
  };
  await prisma.companySettings.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
  revalidatePath("/", "layout");
  redirect("/configuracion?ok=1");
}

// Acciones públicas: los errores regresan como { error } para mostrarlos en el formulario.
export const saveSettings = safe(saveSettingsImpl, "configuracion", "saveSettingsImpl");
