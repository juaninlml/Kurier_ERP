import { formatMoney, formatNumber } from "@/lib/money";
import { formatCurrency } from "@/lib/currency";
import { groupBySection, rateLabel } from "@/lib/totals";
import { Tr } from "@/components/Tr";

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
  currency = "MXN",
}: {
  kind: "quote" | "invoice";
  items: Item[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  extra?: React.ReactNode;
  /** Moneda de la factura (MXN o CNY). */
  currency?: string;
}) {
  const isQuote = kind === "quote";
  const money = (n: number) => formatCurrency(n, currency);
  const groups = isQuote ? groupBySection(items) : [["", items] as const];

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th><Tr>{isQuote ? "Servicio" : "Concepto"}</Tr></th>
              {isQuote && <th><Tr>Tarifa</Tr></th>}
              {isQuote && <th><Tr>Descripción</Tr></th>}
              <th className="text-right"><Tr>Cantidad</Tr></th>
              {!isQuote && <th className="text-right"><Tr>Precio unitario</Tr></th>}
              <th className="text-right"><Tr>Importe</Tr></th>
            </tr>
          </thead>
          <tbody>
            {groups.map(([section, list]) => (
              <Group key={section} section={section} cols={isQuote ? 5 : 4}>
                {list.map((i) => (
                  <tr key={i.id} className={isQuote && i.quantity === 0 ? "text-muted-foreground" : ""}>
                    <td className="font-medium text-primary">
                      {i.description}
                      {i.code && <div className="font-mono text-[10px] font-normal text-muted-foreground">{i.code}</div>}
                    </td>
                    {isQuote && <td className="whitespace-nowrap font-medium text-kurier">{rateLabel(i, formatMoney)}</td>}
                    {isQuote && <td className="max-w-md whitespace-pre-line text-xs">{i.detail}</td>}
                    <td className="whitespace-nowrap text-right tabular-nums">
                      {i.quantity > 0 ? `${formatNumber(i.quantity)} ${i.unit.toLowerCase()}` : "—"}
                    </td>
                    {!isQuote && (
                      <td className="whitespace-nowrap text-right tabular-nums">
                        {i.priceText || (i.atCost ? <Tr>Variable (al costo)</Tr> : money(i.unitPrice))}
                        {i.discountPct > 0 && <div className="text-xs text-muted-foreground">−{i.discountPct}%</div>}
                      </td>
                    )}
                    <td className="whitespace-nowrap text-right font-medium tabular-nums">{i.amount ? money(i.amount) : "—"}</td>
                  </tr>
                ))}
              </Group>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end border-t border-border bg-muted px-5 py-4">
        <dl className="w-full max-w-xs space-y-1 text-sm">
          {isQuote && <div className="label"><Tr>Costo mensual estimado</Tr></div>}
          <div className="flex justify-between">
            <dt className="text-muted-foreground"><Tr>Subtotal sin IVA</Tr></dt>
            <dd className="tabular-nums">{money(subtotal)}</dd>
          </div>
          {discount > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground"><Tr>Descuento</Tr></dt>
              <dd className="tabular-nums">−{money(discount)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">IVA</dt>
            <dd className="tabular-nums">{money(tax)}</dd>
          </div>
          <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
            <dt><Tr>{isQuote ? "Total estimado" : "Total a pagar"}</Tr></dt>
            <dd className="tabular-nums text-kurier">{money(total)}</dd>
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
          <td colSpan={cols} className="bg-kurier/10 py-1.5 text-xs font-semibold uppercase tracking-wide text-kurier">
            {section}
          </td>
        </tr>
      )}
      {children}
    </>
  );
}
