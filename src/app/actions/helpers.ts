import { z } from "zod";

export const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
export const numv = (fd: FormData, k: string, def = 0) => {
  const v = fd.get(k);
  if (v === null || v === "") return def;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`Valor numérico inválido en ${k}`);
  return n;
};

export const lineSchema = z.object({
  code: z.string().optional().default(""),
  description: z.string().min(1, "Cada concepto necesita descripción"),
  detail: z.string().optional().default(""),
  section: z.string().optional().default(""),
  priceText: z.string().optional().default(""),
  unit: z.string().optional().default("Servicio"),
  quantity: z.number().min(0, "La cantidad no puede ser negativa"),
  unitPrice: z.number().min(0, "El precio no puede ser negativo"),
  discountPct: z.number().min(0).max(100).optional().default(0),
  taxRate: z.number().min(0).max(100).optional().default(0),
  atCost: z.boolean().optional().default(false),
  scales: z.boolean().optional().default(false),
  amount: z.number().min(0).optional().default(0),
});

/**
 * Conceptos del formulario. En facturas se descartan los que no tienen cantidad
 * (o importe, si son al costo); en cotizaciones la cantidad 0 = "solo tarifa".
 */
export function parseItems(fd: FormData, kind: "quote" | "invoice") {
  const raw = JSON.parse(str(fd, "items") || "[]");
  const parsed = z.array(lineSchema).safeParse(raw);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Conceptos inválidos.");
  const items = kind === "invoice" ? parsed.data.filter((i) => i.quantity > 0 || (i.atCost && i.amount > 0)) : parsed.data;
  if (items.length === 0) throw new Error(kind === "invoice" ? "Agrega al menos un concepto con cantidad." : "Agrega al menos un servicio.");
  return items;
}

/** Tabla "Costo por pedido" capturada en el editor. */
export function parsePerOrderForm(fd: FormData) {
  try {
    const raw = JSON.parse(str(fd, "perOrder") || "[]");
    return z
      .array(z.object({ label: z.string(), amount: z.number().min(0, "El costo por pedido no puede ser negativo") }))
      .parse(raw)
      .filter((r) => r.label.trim());
  } catch (e) {
    throw new Error(e instanceof z.ZodError ? (e.issues[0]?.message ?? "Costo por pedido inválido.") : "Costo por pedido inválido.");
  }
}

export function parseProfile(fd: FormData) {
  try {
    const raw = JSON.parse(str(fd, "profile") || "[]");
    return z.array(z.object({ label: z.string(), value: z.string() })).parse(raw).filter((r) => r.label.trim());
  } catch {
    throw new Error("Perfil de la operación inválido.");
  }
}
