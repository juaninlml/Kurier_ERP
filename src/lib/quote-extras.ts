import { computeLines, type LineInput } from "./totals";
import { round2 } from "./money";

/** Fila de la tabla "Costo por pedido". */
export type PerOrderRow = { label: string; amount: number };

export function parsePerOrder(json: string): PerOrderRow[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v)
      ? v.filter((r) => r && typeof r.label === "string" && r.label.trim()).map((r) => ({ label: r.label, amount: Number(r.amount) || 0 }))
      : [];
  } catch {
    return [];
  }
}

/** "250, 500, 1,000" → [250, 500, 1000] (sin repetidos, en orden). */
export function parseVolumes(text: string): number[] {
  const out: number[] = [];
  for (const part of text.split(/[;\s]+|,(?!\d{3}\b)/)) {
    const n = Number(part.replace(/[^\d.]/g, ""));
    if (n > 0 && !out.includes(n)) out.push(n);
  }
  return out.slice(0, 5);
}

type ScenarioLine = Pick<LineInput, "description" | "quantity" | "unitPrice" | "discountPct" | "taxRate" | "atCost" | "amount" | "scales" | "unit">;

/**
 * Tabla "Costo mensual según volumen": recalcula el costo estimado para cada volumen.
 * Los conceptos marcados con `scales` crecen en proporción (volumen ÷ pedidos base); los demás quedan fijos.
 */
export function scenarioTable(items: ScenarioLine[], baseVolume: number, volumes: number[], money: (n: number) => string) {
  const lines = items.filter((i) => i.quantity > 0 && (i.atCost ? (i.amount ?? 0) > 0 : i.unitPrice > 0));
  if (!lines.length || baseVolume <= 0 || !volumes.length) return null;
  const columns = volumes.map((v) => {
    const k = v / baseVolume;
    return computeLines(
      lines.map((l) => ({
        ...l,
        quantity: l.scales ? l.quantity * k : l.quantity,
        amount: l.atCost && l.scales ? round2((l.amount ?? 0) * k) : l.amount,
      })),
    );
  });
  return {
    rows: lines.map((l, i) => ({
      label: l.scales && !l.atCost ? `${l.description} × ${money(l.unitPrice)}` : l.description,
      values: columns.map((c) => c.items[i].amount),
    })),
    subtotal: columns.map((c) => round2(c.subtotal - c.discount)),
    tax: columns.map((c) => c.tax),
    total: columns.map((c) => c.total),
  };
}
