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
  unit: z.string().optional().default("Servicio"),
  quantity: z.number().positive("La cantidad debe ser mayor a 0"),
  unitPrice: z.number().min(0, "El precio no puede ser negativo"),
  discountPct: z.number().min(0).max(100).optional().default(0),
  taxRate: z.number().min(0).max(100).optional().default(0),
});

export function parseItems(fd: FormData) {
  const raw = JSON.parse(str(fd, "items") || "[]");
  const items = z.array(lineSchema).parse(raw);
  if (items.length === 0) throw new Error("Agrega al menos un concepto.");
  return items;
}
