import Link from "next/link";
import { PieChart } from "lucide-react";
import { profitability, NOT_ALLOCATED } from "@/lib/profitability";
import { parseRange } from "@/lib/reports";
import { PageHeader, Stat, Empty } from "@/components/kit";
import { ExportButton } from "@/components/ExportButton";
import { formatDate, formatMoney, formatNumber, toInputDate } from "@/lib/money";
import { getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await getT())("Rentabilidad por cliente") };
}

function presets() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = (yy: number, mm: number, dd: number) => toInputDate(new Date(Date.UTC(yy, mm, dd, 12)));
  const q = Math.floor(m / 3) * 3;
  return [
    { label: "Este mes", from: d(y, m, 1), to: d(y, m + 1, 0) },
    { label: "Mes anterior", from: d(y, m - 1, 1), to: d(y, m, 0) },
    { label: "Trimestre", from: d(y, q, 1), to: d(y, q + 3, 0) },
    { label: "Este año", from: d(y, 0, 1), to: d(y, 11, 31) },
  ];
}

const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(1)}%`);

export default async function ProfitabilityPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const t = await getT();
  const sp = await searchParams;
  const { from, to } = parseRange(sp.from, sp.to);
  const fromStr = toInputDate(from);
  const toStr = toInputDate(to);
  const r = await profitability(from, to);
  const margin = r.totals.revenue > 0 ? r.totals.profit / r.totals.revenue : null;
  const basisText =
    r.basis === "orders"
      ? t("según su participación en las órdenes procesadas ({n} en el periodo)", { n: formatNumber(r.totals.orders) })
      : r.basis === "revenue"
        ? t("según su participación en lo facturado (no hay órdenes diarias capturadas en el periodo)")
        : t("(no hay órdenes ni facturas en el periodo para repartirlos)");

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Rentabilidad por cliente"
        subtitle={t("Periodo: {v0} – {v1}", { v0: formatDate(from), v1: formatDate(to) })}
        back={{ href: "/contabilidad/reportes", label: t("Reportes") }}
        actions={<ExportButton kind="rentabilidad" params={{ desde: fromStr, hasta: toStr }} />}
      />

      <div className="mb-6 flex flex-wrap items-end gap-2">
        {presets().map((p) => (
          <Link
            key={p.label}
            href={`/contabilidad/rentabilidad?from=${p.from}&to=${p.to}`}
            aria-current={p.from === fromStr && p.to === toStr ? "true" : undefined}
            className="btn-secondary aria-[current]:border-primary/40 aria-[current]:bg-primary/5 aria-[current]:text-primary"
          >
            {t(p.label)}
          </Link>
        ))}
        <form className="ml-auto flex flex-wrap items-end gap-2">
          <label>
            <span className="label">{t("Desde")}</span>
            <input type="date" name="from" defaultValue={fromStr} className="input" />
          </label>
          <label>
            <span className="label">{t("Hasta")}</span>
            <input type="date" name="to" defaultValue={toStr} className="input" />
          </label>
          <button className="btn-secondary">{t("Aplicar")}</button>
        </form>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Facturado sin IVA" value={formatMoney(r.totals.revenue)} />
        <Stat label="Insumos de empaque" value={formatMoney(r.totals.supplies)} hint={t("Consumo real por cliente")} />
        <Stat label="Costo operativo repartido" value={formatMoney(r.totals.allocated)} hint={t("De {v0} en egresos sin IVA", { v0: formatMoney(r.pool) })} />
        <Stat label="Utilidad estimada" value={formatMoney(r.totals.profit)} tone={r.totals.profit >= 0 ? "pos" : "neg"} hint={t("Margen {v0}", { v0: pct(margin) })} />
      </div>

      <div className="card overflow-hidden">
        {r.rows.length === 0 ? (
          <Empty icon={PieChart}>{t("Sin facturas, órdenes ni insumos de clientes en este periodo.")}</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("Cliente")}</th>
                  <th className="text-right">{t("Órdenes")}</th>
                  <th className="text-right">{t("Facturado")}</th>
                  <th className="text-right">{t("Insumos")}</th>
                  <th className="text-right">{t("Operativo")}</th>
                  <th className="text-right">{t("Utilidad")}</th>
                  <th className="text-right">{t("Margen")}</th>
                  <th className="text-right">{t("Ingreso / orden")}</th>
                  <th className="text-right">{t("Costo / orden")}</th>
                </tr>
              </thead>
              <tbody>
                {r.rows.map((x) => (
                  <tr key={x.clientId}>
                    <td>
                      <Link href={`/clientes/${x.clientId}`} className="font-medium text-primary hover:underline">
                        {x.name}
                      </Link>
                    </td>
                    <td className="text-right tabular-nums">{x.orders ? formatNumber(x.orders) : "—"}</td>
                    <td className="text-right tabular-nums">{formatMoney(x.revenue)}</td>
                    <td className="text-right text-muted-foreground tabular-nums">{formatMoney(x.supplies)}</td>
                    <td className="text-right text-muted-foreground tabular-nums">{formatMoney(x.allocated)}</td>
                    <td className={cn("text-right font-medium tabular-nums", x.profit >= 0 ? "text-emerald-700" : "text-rose-700")}>{formatMoney(x.profit)}</td>
                    <td className={cn("text-right tabular-nums", x.margin !== null && x.margin < 0 ? "text-rose-700" : "")}>{pct(x.margin)}</td>
                    <td className="text-right tabular-nums">{x.revenuePerOrder === null ? "—" : formatMoney(x.revenuePerOrder)}</td>
                    <td className="text-right tabular-nums">{x.costPerOrder === null ? "—" : formatMoney(x.costPerOrder)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4 space-y-1 text-xs text-muted-foreground">
        <p>
          {t("Cómo se calcula: facturado sin IVA de las facturas emitidas en el periodo (sin canceladas), menos el costo de los insumos de empaque que consumió cada cliente, menos los demás egresos sin IVA del periodo repartidos")}{" "}
          {basisText}.
        </p>
        <p>{t("No se reparten: {v0}.", { v0: NOT_ALLOCATED.map((c) => t(c)).join(", ") })}</p>
        {r.unallocated > 0.01 && <p>{t("Quedaron {v0} sin repartir.", { v0: formatMoney(r.unallocated) })}</p>}
        <p>{t("Es una estimación para comparar clientes, no un estado de resultados contable.")}</p>
      </div>
    </div>
  );
}
