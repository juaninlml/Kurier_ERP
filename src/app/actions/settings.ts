"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { numv, str } from "./helpers";

const HEX = /^#[0-9a-fA-F]{6}$/;

export async function saveSettings(fd: FormData) {
  const primaryColor = str(fd, "primaryColor");
  const accentColor = str(fd, "accentColor");
  if (!HEX.test(primaryColor) || !HEX.test(accentColor)) throw new Error("Los colores deben ser hex de 6 dígitos (#RRGGBB).");

  let logoPath: string | undefined;
  const logo = fd.get("logo");
  if (logo instanceof File && logo.size > 0) {
    const ext = logo.type === "image/png" ? "png" : logo.type === "image/jpeg" ? "jpg" : null;
    if (!ext) throw new Error("El logo debe ser PNG o JPG.");
    if (logo.size > 2 * 1024 * 1024) throw new Error("El logo no debe pesar más de 2 MB.");
    const dir = path.join(process.cwd(), "public", "branding");
    await mkdir(dir, { recursive: true });
    const file = `logo.${ext}`;
    await writeFile(path.join(dir, file), Buffer.from(await logo.arrayBuffer()));
    logoPath = `/branding/${file}`;
  }

  const data = {
    tradeName: str(fd, "tradeName") || "Kurier Fulfillment",
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
    ...(logoPath ? { logoPath } : {}),
  };
  await prisma.companySettings.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
  revalidatePath("/", "layout");
  redirect("/configuracion?ok=1");
}
