import { formatMoney, formatNumber } from "@/lib/money";

type Item = { id: number; code: string; description: string; unit: string; quantity: number; unitPrice: number; discountPct: number; taxRate: number; amount: number };

/** Vista HTML de conceptos y totales (lo mismo que sale en el PDF). */
export function DocumentView({
  items,
  subtotal,
  discount,
  tax,
  total,
  extra,
}: {
  items: Item[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  extra?: React.ReactNode;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Clave</th>
              <th>Descripción</th>
              <th>Unidad</th>
              <th className="text-right">Cant.</th>
              <th className="text-right">P. Unit.</th>
              <th className="text-right">Desc.</th>
              <th className="text-right">IVA</th>
              <th className="text-right">Importe</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td className="font-mono text-xs text-slate-500">{i.code}</td>
                <td className="whitespace-pre-line">{i.description}</td>
                <td>{i.unit}</td>
                <td className="text-right tabular-nums">{formatNumber(i.quantity)}</td>
                <td className="text-right tabular-nums">{formatMoney(i.unitPrice)}</td>
                <td className="text-right tabular-nums">{i.discountPct ? `${i.discountPct}%` : "—"}</td>
                <td className="text-right tabular-nums">{i.taxRate}%</td>
                <td className="text-right font-medium tabular-nums">{formatMoney(i.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-4">
        <dl className="w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">Subtotal</dt>
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
            <dt>Total</dt>
            <dd className="tabular-nums">{formatMoney(total)}</dd>
          </div>
          {extra}
        </dl>
      </div>
    </div>
  );
}
