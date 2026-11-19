import { Download, Eye } from "lucide-react";
import Link from "next/link";
import { PageHeader, Panel, Stat } from "@/components/kit";
import { BarList, ColumnChart, SegmentedBar } from "@/components/charts";
import { incomeStatement, receivables, parseRange, AGING_BUCKETS } from "@/lib/reports";
import { AGING_LABEL, flowSeries } from "@/lib/insights";
import { formatDate, formatMoney, round2, toInputDate } from "@/lib/money";

export const dynamic = "force-dynamic";

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

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await searchParams;
  const { from, to } = parseRange(sp.from, sp.to);
  const [stmt, ar, flow] = await Promise.all([incomeStatement(from, to), receivables(), flowSeries(from, to)]);
  const fromStr = toInputDate(from);
  const toStr = toInputDate(to);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Reportes financieros"
        subtitle={`Periodo: ${formatDate(from)} – ${formatDate(to)}`}
        actions={
          <>
            <a href={`/api/pdf/reporte?from=${fromStr}&to=${toStr}`} target="_blank" className="btn-secondary">
              <Eye className="size-4" /> Ver PDF
            </a>
            <a href={`/api/pdf/reporte?from=${fromStr}&to=${toStr}&download`} className="btn-primary">
              <Download className="size-4" /> Descargar PDF
            </a>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-end gap-2">
        {presets().map((p) => (
          <Link
            key={p.label}
            href={`/contabilidad/reportes?from=${p.from}&to=${p.to}`}
            aria-current={p.from === fromStr && p.to === toStr ? "true" : undefined}
            className="btn-secondary aria-[current]:border-primary/40 aria-[current]:bg-primary/5 aria-[current]:text-primary"
          >
            {p.label}
          </Link>
        ))}
        <form className="ml-auto flex flex-wrap items-end gap-2">
          <label>
            <span className="label">Desde</span>
            <input type="date" name="from" defaultValue={fromStr} className="input" />
          </label>
          <label>
            <span className="label">Hasta</span>
            <input type="date" name="to" defaultValue={toStr} className="input" />
          </label>
          <button className="btn-secondary">Aplicar</button>
        </form>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Ingresos" value={formatMoney(stmt.incomeTotal)} tone="pos" />
        <Stat label="Egresos" value={formatMoney(stmt.expenseTotal)} tone="neg" />
        <Stat label="Utilidad (sin IVA)" value={formatMoney(stmt.netBeforeTax)} tone={stmt.netBeforeTax >= 0 ? "pos" : "neg"} />
        <Stat label="Por cobrar" value={formatMoney(ar.total)} hint={`${ar.rows.length} factura(s)`} />
      </div>

      <Panel
        className="mb-6"
        title="Ingresos y egresos"
        description={flow.unit === "day" ? "Por día dentro del periodo" : "Por mes dentro del periodo"}
        bodyClassName="p-5"
      >
        <ColumnChart
          height={240}
          series={[
            { key: "income", name: "Ingresos", color: "var(--chart-1)" },
            { key: "expense", name: "Egresos", color: "var(--chart-2)" },
          ]}
          points={flow.points.map((p) => ({ key: p.key, label: p.label, full: p.full, values: { income: p.income, expense: p.expense } }))}
          diff={{ label: "Neto", plus: "income", minus: "expense" }}
          emptyText="Sin movimientos en este periodo."
        />
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        {(
          [
            ["Ingresos por categoría", stmt.income, stmt.incomeTotal, "var(--chart-1)"],
            ["Egresos por categoría", stmt.expense, stmt.expenseTotal, "var(--chart-2)"],
          ] as const
        ).map(([title, rows, total, color]) => (
          <Panel
            key={title}
            title={title}
            action={<span className="font-semibold tabular-nums">{formatMoney(total)}</span>}
            bodyClassName="p-5"
          >
            <BarList
              color={color}
              total={total}
              emptyText="Sin movimientos."
              rows={rows.map((r) => ({ key: r.category, label: r.category, value: r.amount, hint: `(${r.count})` }))}
            />
          </Panel>
        ))}
      </div>

      <div className="card mt-6 p-5">
        <h2 className="mb-3 text-[0.95rem] font-semibold">Resumen de IVA (estimado)</h2>
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">IVA cobrado</dt>
            <dd className="text-lg font-semibold tabular-nums">{formatMoney(stmt.incomeTax)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">IVA pagado</dt>
            <dd className="text-lg font-semibold tabular-nums">{formatMoney(stmt.expenseTax)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Diferencia</dt>
            <dd className="text-lg font-semibold tabular-nums">{formatMoney(stmt.ivaBalance)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">Cifras informativas basadas en los movimientos capturados; no sustituyen la declaración de tu contador.</p>
      </div>

      <div className="card mt-6 overflow-x-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <h2 className="text-[0.95rem] font-semibold">Antigüedad de saldos (cuentas por cobrar)</h2>
          <span className="font-semibold tabular-nums">{formatMoney(ar.total)}</span>
        </div>
        <div className="border-b border-border p-5">
          <SegmentedBar
            emptyText="Sin saldos pendientes"
            parts={AGING_BUCKETS.map((b, i) => ({
              key: b,
              name: AGING_LABEL[b]!,
              value: ar.byBucket[b],
              color: `var(--aging-${i})`,
              ink: i === 1 ? ("dark" as const) : undefined,
            }))}
          />
        </div>
        {ar.rows.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Folio</th>
                <th>Cliente</th>
                <th>Vencimiento</th>
                <th>Días vencida</th>
                <th className="text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {ar.rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/facturas/${r.id}`} className="font-medium text-primary hover:underline">
                      {r.folio}
                    </Link>
                  </td>
                  <td>{r.client.name}</td>
                  <td>{formatDate(r.dueDate)}</td>
                  <td className={r.daysOverdue > 0 ? "text-rose-600" : "text-muted-foreground"}>{r.daysOverdue || "—"}</td>
                  <td className="text-right tabular-nums">{formatMoney(r.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
