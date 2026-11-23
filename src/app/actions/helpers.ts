import { z } from "zod";

export const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
export const numv = (fd: FormData, k: string, def = 0) => {
  const v = fd.get(k);
  if (v === null || v === "") return def;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`Valor numérico inválido en ${k}`);
  return n;
};

/**
 * Logo subido (PNG o JPG, máx. 1 MB). El tipo se comprueba con los primeros bytes del archivo,
 * no con el que declara el navegador, y se guarda ese tipo real.
 */
export async function readLogo(file: File): Promise<{ logoData: Uint8Array<ArrayBuffer>; logoMime: string }> {
  if (file.size > 1024 * 1024) throw new Error("El logo no debe pesar más de 1 MB.");
  const data = new Uint8Array(await file.arrayBuffer());
  const png = data.length > 8 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47;
  const jpg = data.length > 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  if (!png && !jpg) throw new Error("El logo debe ser PNG o JPG.");
  return { logoData: data, logoMime: png ? "image/png" : "image/jpeg" };
}

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
