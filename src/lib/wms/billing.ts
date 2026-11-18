import type { LineInput } from "@/lib/totals";
import { computeLines } from "@/lib/totals";
import { formatMoney, formatNumber, round2 } from "@/lib/money";
import { normalize, type WmsLine, type WmsStatement } from "./types";

/** Tarifa aplicable a un concepto del WMS (negociada con el cliente o del tarifario estándar). */
export type RateLike = {
  code: string;
  name: string;
  description: string;
  wmsConcept: string;
  unit: string;
  unitPrice: number;
  priceText: string;
  atCost: boolean;
  taxRate: number;
};

export type BillingGroup = {
  key: string;
  concept: string;
  section: string;
  lines: WmsLine[];
  source: "cliente" | "tarifario" | "wms";
  rate?: RateLike;
  line: LineInput;
  wmsAmount: number;
  /** Diferencias entre lo que cobró el WMS y la tarifa aplicada. */
  warnings: string[];
};

const SECTION_ORDER = ["SISTEMA", "ALMACENAJE", "ALMACENAMIENTO", "RECEPCION", "MANIOBRAS", "VALOR AGREGADO", "FLETES"];
const sectionRank = (s: string) => {
  const i = SECTION_ORDER.indexOf(normalize(s).toUpperCase());
  return i === -1 ? SECTION_ORDER.length - 1 : i;
};
const cap = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

/** Detalle legible del grupo: paqueterías en fletes, lista de pedidos en el resto. */
function detailFor(lines: WmsLine[]) {
  const carriers = new Map<string, number>();
  for (const l of lines) if (l.carrier) carriers.set(l.carrier, (carriers.get(l.carrier) ?? 0) + 1);
  if (carriers.size) return [...carriers].map(([c, n]) => `${cap(c)}: ${n}`).join(" · ");
  if (lines.length === 1) return lines[0].description;
  const refs = [...new Set(lines.map((l) => l.orderRef).filter(Boolean))];
  return refs.length ? `Pedidos ${refs.length <= 8 ? refs.join(", ") : `${refs.slice(0, 8).join(", ")} y ${refs.length - 8} más`}` : "";
}

/**
 * Agrupa los movimientos del WMS por concepto y les aplica la tarifa del cliente.
 * Prioridad: tarifa negociada del cliente → tarifa estándar del tarifario → precio que trae el WMS.
 * Los fletes (o tarifas marcadas "al costo") se facturan al importe del WMS.
 */
export function buildInvoiceLines(statement: WmsStatement, clientRates: RateLike[], standardRates: RateLike[], defaultTaxRate: number) {
  const byKey = (rates: RateLike[]) => {
    const m = new Map<string, RateLike>();
    for (const r of rates) for (const k of r.wmsConcept.split(/[;\n]/).map(normalize).filter(Boolean)) if (!m.has(k)) m.set(k, r);
    return m;
  };
  const clientMap = byKey(clientRates);
  const stdMap = byKey(standardRates);

  // Concepto genérico ("Concepto especial") → se agrupa por descripción para no mezclar cargos distintos.
  const groupKey = (l: WmsLine) => (normalize(l.concept) === "concepto especial" ? `${normalize(l.concept)}|${normalize(l.description)}` : normalize(l.concept));

  const groups = new Map<string, WmsLine[]>();
  for (const l of statement.lines) groups.set(groupKey(l), [...(groups.get(groupKey(l)) ?? []), l]);

  const result: BillingGroup[] = [...groups.entries()].map(([key, lines]) => {
    const first = lines[0];
    const conceptKey = normalize(first.concept);
    const clientRate = clientMap.get(key) ?? clientMap.get(conceptKey);
    const stdRate = clientRate ? undefined : (stdMap.get(key) ?? stdMap.get(conceptKey));
    const rate = clientRate ?? stdRate;
    const source: BillingGroup["source"] = clientRate ? "cliente" : stdRate ? "tarifario" : "wms";

    const quantity = round2(lines.reduce((a, l) => a + l.quantity, 0));
    const wmsAmount = round2(lines.reduce((a, l) => a + l.amount, 0));
    const isFreight = normalize(first.section) === "fletes";
    const atCost = rate ? rate.atCost : isFreight;
    const prices = [...new Set(lines.map((l) => l.unitPrice))];
    const warnings: string[] = [];

    let unitPrice: number;
    if (atCost) unitPrice = quantity ? round2(wmsAmount / quantity) : 0;
    else if (rate) {
      unitPrice = rate.unitPrice;
      const off = prices.filter((p) => Math.abs(p - rate.unitPrice) > 0.004);
      if (off.length) warnings.push(`El WMS cobró ${off.map(formatMoney).join(", ")} y la tarifa ${source === "cliente" ? "del cliente" : "estándar"} es ${formatMoney(rate.unitPrice)}.`);
    } else {
      unitPrice = prices.length === 1 ? prices[0] : quantity ? round2(wmsAmount / quantity) : 0;
      if (prices.length > 1) warnings.push(`El WMS usó varios precios (${prices.map(formatMoney).join(", ")}); se tomó el promedio.`);
    }

    const description =
      rate?.name ?? (normalize(first.concept) === "concepto especial" && first.description ? first.description : cap(first.concept));
    const line: LineInput = {
      code: rate?.code ?? "",
      description,
      detail: detailFor(lines),
      section: cap(first.section.toLowerCase()),
      priceText: atCost ? "Variable (al costo)" : (rate?.priceText ?? ""),
      unit: rate?.unit ?? cap(first.unit || "servicio"),
      quantity,
      unitPrice,
      discountPct: 0,
      taxRate: rate?.taxRate ?? defaultTaxRate,
      atCost,
      amount: atCost ? wmsAmount : 0,
    };
    return { key, concept: first.concept, section: first.section, lines, source, rate, line, wmsAmount, warnings };
  });

  result.sort((a, b) => sectionRank(a.section) - sectionRank(b.section));
  const totals = computeLines(result.map((g) => g.line));
  const orders = new Set(statement.lines.filter((l) => /pedido/i.test(l.concept) && !/env[ií]o/i.test(l.concept)).map((l) => l.orderRef).filter(Boolean));
  const shipments = statement.lines.filter((l) => normalize(l.section) === "fletes").length;

  return {
    groups: result,
    totals,
    difference: round2(totals.total - statement.total),
    orders: orders.size,
    shipments,
    volumeText: [
      orders.size ? `${formatNumber(orders.size)} pedido(s)` : "",
      shipments ? `${formatNumber(shipments)} envío(s)` : "",
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

/** "2026-10-19" + "2026-10-25" → "19 al 25 de octubre de 2026". */
export function periodText(from?: string, to?: string, fallback = "") {
  if (!from || !to) return fallback;
  const f = new Date(`${from}T12:00:00Z`);
  const t = new Date(`${to}T12:00:00Z`);
  const month = (d: Date) => d.toLocaleDateString("es-MX", { month: "long", timeZone: "UTC" });
  const sameMonth = f.getUTCMonth() === t.getUTCMonth() && f.getUTCFullYear() === t.getUTCFullYear();
  const sameYear = f.getUTCFullYear() === t.getUTCFullYear();
  const days = Math.round((t.getTime() - f.getTime()) / 86400000) + 1;
  const cycle = days === 7 ? " — ciclo semanal" : days >= 14 && days <= 16 ? " — ciclo quincenal" : "";
  const text = sameMonth
    ? `${f.getUTCDate()} al ${t.getUTCDate()} de ${month(t)} de ${t.getUTCFullYear()}`
    : `${f.getUTCDate()} de ${month(f)}${sameYear ? "" : ` de ${f.getUTCFullYear()}`} al ${t.getUTCDate()} de ${month(t)} de ${t.getUTCFullYear()}`;
  return text + cycle;
}
