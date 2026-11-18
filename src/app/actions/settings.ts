"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { numv, str } from "./helpers";

const HEX = /^#[0-9a-fA-F]{6}$/;

export async function saveSettings(fd: FormData) {
  const primaryColor = str(fd, "primaryColor");
  const accentColor = str(fd, "accentColor");
  if (!HEX.test(primaryColor) || !HEX.test(accentColor)) throw new Error("Los colores deben ser hex de 6 dígitos (#RRGGBB).");

  // El logo se guarda en la base de datos (en Vercel el disco es de solo lectura).
  let logo: { logoData: Uint8Array<ArrayBuffer> | null; logoMime: string } | undefined;
  const file = fd.get("logo");
  if (fd.get("removeLogo") === "on") {
    logo = { logoData: null, logoMime: "" };
  } else if (file instanceof File && file.size > 0) {
    if (file.type !== "image/png" && file.type !== "image/jpeg") throw new Error("El logo debe ser PNG o JPG.");
    if (file.size > 1024 * 1024) throw new Error("El logo no debe pesar más de 1 MB.");
    logo = { logoData: new Uint8Array(await file.arrayBuffer()), logoMime: file.type };
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
