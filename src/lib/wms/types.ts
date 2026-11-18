import { z } from "zod";

/**
 * Formato común de un "estado de cobro" del WMS.
 * Hoy lo produce el lector de PDF; cuando el WMS se conecte por API debe enviar este mismo JSON
 * a POST /api/wms/statements.
 */
export const wmsLineSchema = z.object({
  date: z.string().default(""), // AAAA-MM-DD
  section: z.string().default(""), // SISTEMA, FLETES, MANIOBRAS, ALMACENAJE…
  concept: z.string().min(1), // "Procesamiento de pedido"
  description: z.string().default(""), // "Procesamiento de pedido P-1158"
  quantity: z.number(),
  unit: z.string().default(""),
  unitPrice: z.number(),
  amount: z.number(),
  orderRef: z.string().optional(), // P-1158
  carrier: z.string().optional(), // imile, estafeta…
});

export const wmsStatementSchema = z.object({
  folio: z.string().min(1),
  clientName: z.string().min(1),
  periodLabel: z.string().default(""),
  periodFrom: z.string().optional(), // AAAA-MM-DD
  periodTo: z.string().optional(),
  issuedAt: z.string().optional(),
  currency: z.string().default("MXN"),
  lines: z.array(wmsLineSchema).min(1, "El estado de cobro no tiene movimientos."),
  subtotal: z.number().default(0),
  tax: z.number().default(0),
  total: z.number().default(0),
});

export type WmsLine = z.infer<typeof wmsLineSchema>;
export type WmsStatement = z.infer<typeof wmsStatementSchema>;

/** Normaliza textos para comparar conceptos y nombres ("Picking pieza/bulto  adicional" ≈ "picking pieza/bulto adicional"). */
export const normalize = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9/]+/g, " ")
    .trim();
