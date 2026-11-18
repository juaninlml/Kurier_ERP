import Link from "next/link";
import { PageHeader, Stat } from "@/components/ui";
import { incomeStatement, receivables, parseRange, AGING_BUCKETS } from "@/lib/reports";
import { formatDate, formatMoney, toInputDate } from "@/lib/money";

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
  const [stmt, ar] = await Promise.all([incomeStatement(from, to), receivables()]);
  const fromStr = toInputDate(from);
  const toStr = toInputDate(to);
  const maxCat = Math.max(1, ...stmt.income.map((r) => r.amount), ...stmt.expense.map((r) => r.amount));

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Reportes financieros"
        subtitle={`Periodo: ${formatDate(from)} – ${formatDate(to)}`}
        actions={
          <>
            <a href={`/api/pdf/reporte?from=${fromStr}&to=${toStr}`} target="_blank" className="btn-secondary">
              Ver PDF
            </a>
            <a href={`/api/pdf/reporte?from=${fromStr}&to=${toStr}&download`} className="btn-primary">
              Descargar PDF
            </a>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-end gap-2">
        {presets().map((p) => (
          <Link
            key={p.label}
            href={`/contabilidad/reportes?from=${p.from}&to=${p.to}`}
            className={`btn-secondary ${p.from === fromStr && p.to === toStr ? "ring-2 ring-brand/30" : ""}`}
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

      <div className="grid gap-6 lg:grid-cols-2">
        {(
          [
            ["Ingresos por categoría", stmt.income, stmt.incomeTotal, "bg-emerald-500"],
            ["Egresos por categoría", stmt.expense, stmt.expenseTotal, "bg-rose-500"],
          ] as const
        ).map(([title, rows, total, bar]) => (
          <div key={title} className="card p-5">
            <div className="mb-4 flex justify-between">
              <h2 className="font-semibold">{title}</h2>
              <span className="font-semibold tabular-nums">{formatMoney(total)}</span>
            </div>
            {rows.length === 0 ? (
              <p className="text-sm text-slate-500">Sin movimientos.</p>
            ) : (
              <ul className="space-y-3">
                {rows.map((r) => (
                  <li key={r.category}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>
                        {r.category} <span className="text-slate-400">({r.count})</span>
                      </span>
                      <span className="tabular-nums">{formatMoney(r.amount)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className={`h-2 rounded-full ${bar}`} style={{ width: `${(r.amount / maxCat) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      <div className="card mt-6 p-5">
        <h2 className="mb-3 font-semibold">Resumen de IVA (estimado)</h2>
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-500">IVA cobrado</dt>
            <dd className="text-lg font-semibold tabular-nums">{formatMoney(stmt.incomeTax)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">IVA pagado</dt>
            <dd className="text-lg font-semibold tabular-nums">{formatMoney(stmt.expenseTax)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Diferencia</dt>
            <dd className="text-lg font-semibold tabular-nums">{formatMoney(stmt.ivaBalance)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-slate-500">Cifras informativas basadas en los movimientos capturados; no sustituyen la declaración de tu contador.</p>
      </div>

      <div className="card mt-6 overflow-x-auto">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="font-semibold">Antigüedad de saldos (cuentas por cobrar)</h2>
        </div>
        <div className="grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-200 sm:grid-cols-5">
          {AGING_BUCKETS.map((b) => (
            <div key={b} className="p-4">
              <div className="text-xs uppercase text-slate-500">{b === "corriente" ? "Al corriente" : `${b} días`}</div>
              <div className={`mt-1 font-semibold tabular-nums ${b !== "corriente" && ar.byBucket[b] > 0 ? "text-rose-700" : ""}`}>{formatMoney(ar.byBucket[b])}</div>
            </div>
          ))}
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
                    <Link href={`/facturas/${r.id}`} className="font-medium text-brand hover:underline">
                      {r.folio}
                    </Link>
                  </td>
                  <td>{r.client.name}</td>
                  <td>{formatDate(r.dueDate)}</td>
                  <td className={r.daysOverdue > 0 ? "text-rose-600" : "text-slate-400"}>{r.daysOverdue || "—"}</td>
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
