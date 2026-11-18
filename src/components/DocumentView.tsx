import { formatMoney, formatNumber } from "@/lib/money";
import { groupBySection, rateLabel } from "@/lib/totals";

type Item = {
  id: number;
  code: string;
  description: string;
  detail: string;
  section: string;
  priceText: string;
  atCost: boolean;
  unit: string;
  quantity: number;
  unitPrice: number;
  discountPct: number;
  taxRate: number;
  amount: number;
};

/** Vista HTML de conceptos y totales (lo mismo que sale en el PDF). */
export function DocumentView({
  kind,
  items,
  subtotal,
  discount,
  tax,
  total,
  extra,
}: {
  kind: "quote" | "invoice";
  items: Item[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  extra?: React.ReactNode;
}) {
  const isQuote = kind === "quote";
  const groups = isQuote ? groupBySection(items) : [["", items] as const];

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>{isQuote ? "Servicio" : "Concepto"}</th>
              {isQuote && <th>Tarifa</th>}
              {isQuote && <th>Descripción</th>}
              <th className="text-right">Cantidad</th>
              {!isQuote && <th className="text-right">Precio unitario</th>}
              <th className="text-right">Importe</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(([section, list]) => (
              <Group key={section} section={section} cols={isQuote ? 5 : 4}>
                {list.map((i) => (
                  <tr key={i.id} className={isQuote && i.quantity === 0 ? "text-slate-500" : ""}>
                    <td className="font-medium text-brand">
                      {i.description}
                      {i.code && <div className="font-mono text-[10px] font-normal text-slate-400">{i.code}</div>}
                    </td>
                    {isQuote && <td className="whitespace-nowrap font-medium text-accent">{rateLabel(i, formatMoney)}</td>}
                    {isQuote && <td className="max-w-md whitespace-pre-line text-xs">{i.detail}</td>}
                    <td className="whitespace-nowrap text-right tabular-nums">
                      {i.quantity > 0 ? `${formatNumber(i.quantity)} ${i.unit.toLowerCase()}` : "—"}
                    </td>
                    {!isQuote && (
                      <td className="whitespace-nowrap text-right tabular-nums">
                        {i.priceText || (i.atCost ? "Variable (al costo)" : formatMoney(i.unitPrice))}
                        {i.discountPct > 0 && <div className="text-xs text-slate-400">−{i.discountPct}%</div>}
                      </td>
                    )}
                    <td className="whitespace-nowrap text-right font-medium tabular-nums">{i.amount ? formatMoney(i.amount) : "—"}</td>
                  </tr>
                ))}
              </Group>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-4">
        <dl className="w-full max-w-xs space-y-1 text-sm">
          {isQuote && <div className="label">Costo mensual estimado</div>}
          <div className="flex justify-between">
            <dt className="text-slate-500">Subtotal sin IVA</dt>
            <dd className="tabular-nums">{formatMoney(subtotal)}</dd>
          </div>
          {discount > 0 && (
            <div className="flex justify-between">
              <dt className="text-slate-500">Descuento</dt>
              <dd className="tabular-nums">−{formatMoney(discount)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-slate-500">IVA</dt>
            <dd className="tabular-nums">{formatMoney(tax)}</dd>
          </div>
          <div className="flex justify-between border-t border-slate-300 pt-2 text-base font-semibold">
            <dt>{isQuote ? "Total estimado" : "Total a pagar"}</dt>
            <dd className="tabular-nums text-accent">{formatMoney(total)}</dd>
          </div>
          {extra}
        </dl>
      </div>
    </div>
  );
}

function Group({ section, cols, children }: { section: string; cols: number; children: React.ReactNode }) {
  return (
    <>
      {section && (
        <tr>
          <td colSpan={cols} className="bg-accent/10 py-1.5 text-xs font-semibold uppercase tracking-wide text-accent">
            {section}
          </td>
        </tr>
      )}
      {children}
    </>
  );
}
