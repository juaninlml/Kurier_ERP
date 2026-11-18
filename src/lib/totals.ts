import { round2 } from "./money";

export type LineInput = {
  code?: string;
  description: string;
  detail?: string;
  section?: string;
  priceText?: string;
  unit?: string;
  quantity: number;
  unitPrice: number;
  discountPct?: number;
  taxRate?: number;
  /** Concepto facturado al costo (ej. guía de envío): el importe se captura directo. */
  atCost?: boolean;
  /** Importe capturado cuando atCost = true. */
  amount?: number;
};

export function computeLines(lines: LineInput[]) {
  let gross = 0;
  let discount = 0;
  let tax = 0;
  const items = lines.map((l, i) => {
    const atCost = Boolean(l.atCost);
    const lineGross = atCost ? round2(l.amount ?? 0) : round2(l.quantity * l.unitPrice);
    const lineDiscount = atCost ? 0 : round2(lineGross * ((l.discountPct ?? 0) / 100));
    const amount = round2(lineGross - lineDiscount);
    const lineTax = round2(amount * ((l.taxRate ?? 0) / 100));
    gross += lineGross;
    discount += lineDiscount;
    tax += lineTax;
    return {
      position: i,
      code: l.code ?? "",
      description: l.description,
      detail: l.detail ?? "",
      section: l.section ?? "",
      priceText: l.priceText ?? "",
      unit: l.unit ?? "Servicio",
      quantity: l.quantity,
      unitPrice: atCost ? (l.quantity > 0 ? round2(amount / l.quantity) : 0) : l.unitPrice,
      discountPct: atCost ? 0 : (l.discountPct ?? 0),
      taxRate: l.taxRate ?? 0,
      atCost,
      amount,
    };
  });
  const subtotal = round2(gross);
  discount = round2(discount);
  tax = round2(tax);
  return { items, subtotal, discount, tax, total: round2(subtotal - discount + tax) };
}

/** Texto de la columna "Tarifa": "$35.00 / pedido", o el texto libre si existe. */
export function rateLabel(
  i: { priceText: string; unitPrice: number; unit: string; atCost: boolean },
  money: (n: number) => string,
) {
  if (i.priceText.trim()) return i.priceText;
  if (i.atCost) return "Al costo";
  const unit = i.unit.trim();
  return unit && unit !== "—" ? `${money(i.unitPrice)} / ${unit.toLowerCase()}` : money(i.unitPrice);
}

/** Agrupa conceptos por sección conservando el orden de aparición. */
export function groupBySection<T extends { section: string }>(items: T[], fallback = "Otros servicios") {
  const map = new Map<string, T[]>();
  for (const i of items) {
    const k = i.section || fallback;
    map.set(k, [...(map.get(k) ?? []), i]);
  }
  return [...map.entries()];
}
