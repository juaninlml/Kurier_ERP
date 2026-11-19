import type { Brand, CompanySettings } from "@prisma/client";
import { prisma } from "./db";
import { getSettingsWithLogo } from "./settings";

/*
 * Marcas comerciales: la principal es la Configuración (CompanySettings). Las adicionales
 * (Brand) reemplazan identidad, contacto, banco, colores, logo y prefijos de folio; todo lo
 * demás (IVA, condiciones, días de crédito, textos) se comparte.
 */

const IDENTITY = [
  "tradeName",
  "tagline",
  "legalName",
  "rfc",
  "address",
  "city",
  "state",
  "zip",
  "phone",
  "email",
  "website",
  "bankName",
  "bankAccount",
  "clabe",
  "primaryColor",
  "accentColor",
] as const;

/** Configuración con los datos de la marca aplicados (misma forma que CompanySettings, para los PDFs). */
export function applyBrand(s: CompanySettings, b: Brand | null | undefined): CompanySettings {
  if (!b) return s;
  const out = { ...s };
  for (const k of IDENTITY) (out as Record<string, unknown>)[k] = b[k];
  // Banco vacío en la marca: se usa el de la principal (misma razón social).
  for (const k of ["legalName", "rfc", "bankName", "bankAccount", "clabe", "address", "city", "state", "zip"] as const) if (!b[k]) out[k] = s[k];
  // Logo: el de la marca; sin logo propio no se usa el de la principal (sería de otra marca).
  out.logoData = b.logoData;
  out.logoMime = b.logoMime;
  out.logoPath = "";
  if (b.quotePrefix) out.quotePrefix = b.quotePrefix;
  if (b.invoicePrefix) out.invoicePrefix = b.invoicePrefix;
  return out;
}

/** Configuración para el PDF de un documento según su marca. */
export async function settingsForBrand(brandId: number | null | undefined) {
  const [s, b] = await Promise.all([getSettingsWithLogo(), brandId ? prisma.brand.findUnique({ where: { id: brandId } }) : null]);
  return applyBrand(s, b);
}

/** Marcas para selectores: la principal (id 0) y las adicionales activas. */
export async function brandOptions() {
  const [s, brands] = await Promise.all([
    prisma.companySettings.findUnique({ where: { id: 1 }, select: { tradeName: true } }),
    prisma.brand.findMany({ where: { active: true }, select: { id: true, tradeName: true }, orderBy: { tradeName: "asc" } }),
  ]);
  return [{ id: 0, name: `${s?.tradeName || "Marca principal"} (principal)` }, ...brands.map((b) => ({ id: b.id, name: b.tradeName }))];
}

/** Prefijo de folio de la marca (vacío = el de la principal). */
export async function brandPrefix(brandId: number | null | undefined, kind: "quote" | "invoice") {
  if (!brandId) return "";
  const b = await prisma.brand.findUnique({ where: { id: brandId }, select: { quotePrefix: true, invoicePrefix: true } });
  return (kind === "quote" ? b?.quotePrefix : b?.invoicePrefix) ?? "";
}
