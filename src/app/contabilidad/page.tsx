import Link from "next/link";
import { prisma } from "@/lib/db";
import { createTransaction } from "@/app/actions/accounting";
import { PageHeader, Stat, Empty } from "@/components/kit";
import { TransactionForm } from "@/components/TransactionForm";
import { formatDate, formatMoney, round2, toInputDate } from "@/lib/money";
import { parseRange } from "@/lib/reports";
import { getSettings } from "@/lib/settings";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function AccountingPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; type?: string; category?: string }>;
}) {
  const sp = await searchParams;
  const { from, to } = parseRange(sp.from, sp.to);
  const [txs, clients, settings] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        date: { gte: from, lte: to },
        ...(sp.type ? { type: sp.type } : {}),
        ...(sp.category ? { category: sp.category } : {}),
      },
      include: { client: { select: { name: true } }, payment: { select: { invoiceId: true } } },
      orderBy: [{ date: "desc" }, { id: "desc" }],
    }),
    prisma.client.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getSettings(),
  ]);
  const income = round2(txs.filter((t) => t.type === "INGRESO").reduce((a, t) => a + t.amount, 0));
  const expense = round2(txs.filter((t) => t.type === "EGRESO").reduce((a, t) => a + t.amount, 0));
  const fromStr = toInputDate(from);
  const toStr = toInputDate(to);

  return (
    <div>
      <PageHeader
        title="Contabilidad"
        subtitle={`Movimientos del ${formatDate(from)} al ${formatDate(to)}`}
        actions={
          <>
            <Link href={`/contabilidad/reportes?from=${fromStr}&to=${toStr}`} className="btn-secondary">
              Ver reportes
            </Link>
            <a href={`/api/pdf/reporte?from=${fromStr}&to=${toStr}`} target="_blank" className="btn-primary">
              Reporte PDF
            </a>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Ingresos" value={formatMoney(income)} tone="pos" />
        <Stat label="Egresos" value={formatMoney(expense)} tone="neg" />
        <Stat label="Flujo neto" value={formatMoney(round2(income - expense))} tone={income - expense >= 0 ? "pos" : "neg"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <form className="mb-4 flex flex-wrap items-end gap-2">
            <label>
              <span className="label">Desde</span>
              <input type="date" name="from" defaultValue={fromStr} className="input" />
            </label>
            <label>
              <span className="label">Hasta</span>
              <input type="date" name="to" defaultValue={toStr} className="input" />
            </label>
            <label>
              <span className="label">Tipo</span>
              <select name="type" defaultValue={sp.type ?? ""} className="input">
                <option value="">Todos</option>
                <option value="INGRESO">Ingresos</option>
                <option value="EGRESO">Egresos</option>
              </select>
            </label>
            <label>
              <span className="label">Categoría</span>
              <select name="category" defaultValue={sp.category ?? ""} className="input">
                <option value="">Todas</option>
                <optgroup label="Ingresos">
                  {INCOME_CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </optgroup>
                <optgroup label="Egresos">
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </optgroup>
              </select>
            </label>
            <button className="btn-secondary">Filtrar</button>
          </form>

          <div className="card overflow-x-auto">
            {txs.length === 0 ? (
              <Empty>Sin movimientos en este periodo.</Empty>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Concepto</th>
                    <th>Categoría</th>
                    <th>Método</th>
                    <th className="text-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {txs.map((t) => (
                    <tr key={t.id}>
                      <td className="whitespace-nowrap">{formatDate(t.date)}</td>
                      <td>
                        {t.payment ? (
                          <Link href={`/facturas/${t.payment.invoiceId}`} className="hover:text-primary">
                            {t.description}
                          </Link>
                        ) : (
                          <Link href={`/contabilidad/movimientos/${t.id}`} className="hover:text-primary">
                            {t.description || "(sin concepto)"}
                          </Link>
                        )}
                        {t.client && !t.payment && <div className="text-xs text-muted-foreground">{t.client.name}</div>}
                      </td>
                      <td className="text-muted-foreground">{t.category}</td>
                      <td className="text-muted-foreground">
                        {t.method}
                        {t.reference && <div className="text-xs text-muted-foreground">{t.reference}</div>}
                      </td>
                      <td className={`whitespace-nowrap text-right font-medium tabular-nums ${t.type === "INGRESO" ? "text-emerald-700" : "text-rose-700"}`}>
                        {t.type === "INGRESO" ? "+" : "−"}
                        {formatMoney(t.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="card h-fit p-5">
          <h2 className="mb-3 font-semibold">Nuevo movimiento</h2>
          <TransactionForm
            action={createTransaction}
            clients={clients}
            defaultTaxRate={settings.defaultTaxRate}
            submitLabel="Registrar movimiento"
            tx={{ type: "EGRESO", category: "", amount: 0, tax: 0, date: toInputDate(new Date()), description: "", method: "Transferencia", reference: "", clientId: null }}
          />
        </div>
      </div>
    </div>
  );
}
