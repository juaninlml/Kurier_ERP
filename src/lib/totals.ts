import { round2 } from "./money";

export type LineInput = {
  code?: string;
  description: string;
  unit?: string;
  quantity: number;
  unitPrice: number;
  discountPct?: number;
  taxRate?: number;
};

export function computeLines(lines: LineInput[]) {
  let gross = 0;
  let discount = 0;
  let tax = 0;
  const items = lines.map((l, i) => {
    const lineGross = round2(l.quantity * l.unitPrice);
    const lineDiscount = round2(lineGross * ((l.discountPct ?? 0) / 100));
    const amount = round2(lineGross - lineDiscount);
    const lineTax = round2(amount * ((l.taxRate ?? 0) / 100));
    gross += lineGross;
    discount += lineDiscount;
    tax += lineTax;
    return {
      position: i,
      code: l.code ?? "",
      description: l.description,
      unit: l.unit ?? "Servicio",
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      discountPct: l.discountPct ?? 0,
      taxRate: l.taxRate ?? 0,
      amount,
    };
  });
  const subtotal = round2(gross);
  discount = round2(discount);
  tax = round2(tax);
  return { items, subtotal, discount, tax, total: round2(subtotal - discount + tax) };
}
