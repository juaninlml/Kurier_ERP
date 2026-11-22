import Link from "next/link";
import { prisma } from "@/lib/db";
import { createTransaction } from "@/app/actions/accounting";
import { PageHeader, Stat, Empty, Panel } from "@/components/kit";
import { TransactionForm } from "@/components/TransactionForm";
import { formatDate, formatMoney, round2, toInputDate } from "@/lib/money";
import { parseRange } from "@/lib/reports";
import { flowSeries } from "@/lib/insights";
import { ColumnChart } from "@/components/charts";
import { getSettings } from "@/lib/settings";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/constants";
import { getT } from "@/lib/i18n/server";
import { Tr } from "@/components/Tr";

export const dynamic = "force-dynamic";

export default async function AccountingPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; type?: string; category?: string; cp?: string; proveedor?: string; nuevo?: string }>;
}) {
  const tr = await getT();
  const t = await getT();
  const sp = await searchParams;
  const { from, to } = parseRange(sp.from, sp.to);
  // Filtro por contraparte: "c12" = cliente 12, "p5" = proveedor 5
  const cpId = Number(sp.cp?.slice(1)) || 0;
  const cpWhere = !cpId ? {} : sp.cp?.startsWith("c") ? { clientId: cpId } : sp.cp?.startsWith("p") ? { supplierId: cpId } : {};
  const [txs, clients, suppliers, settings, flow] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        date: { gte: from, lte: to },
        ...(sp.type ? { type: sp.type } : {}),
        ...(sp.category ? { category: sp.category } : {}),
        ...cpWhere,
      },
      include: {
        client: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        payment: { select: { invoiceId: true } },
      },
      orderBy: [{ date: "desc" }, { id: "desc" }],
    }),
    prisma.client.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.supplier.findMany({ where: { active: true }, select: { id: true, name: true, category: true }, orderBy: { name: "asc" } }),
    getSettings(),
    flowSeries(from, to),
  ]);
  const income = round2(txs.filter((t) => t.type === "INGRESO").reduce((a, t) => a + t.amount, 0));
  const expense = round2(txs.filter((t) => t.type === "EGRESO").reduce((a, t) => a + t.amount, 0));
  // "Registrar pago" desde la ficha de un proveedor: egreso con el proveedor y su giro ya puestos
  const preSupplier = sp.nuevo === "egreso" ? suppliers.find((s) => s.id === Number(sp.proveedor)) : undefined;
  const fromStr = toInputDate(from);
  const toStr = toInputDate(to);

  return (
    <div>
      <PageHeader
        title={t("Contabilidad")}
        subtitle={tr("Movimientos del {v0} al {v1}", { v0: formatDate(from), v1: formatDate(to) })}
        actions={
          <>
            <Link href="/contabilidad/gastos-fijos" className="btn-secondary">
              <Tr>Gastos fijos y punto de equilibrio</Tr>
            </Link>
            <Link href={`/contabilidad/reportes?from=${fromStr}&to=${toStr}`} className="btn-secondary">
              <Tr>Ver reportes</Tr>
            </Link>
            <a href={`/api/pdf/reporte?from=${fromStr}&to=${toStr}`} target="_blank" className="btn-primary">
              <Tr>Reporte PDF</Tr>
            </a>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label={t("Ingresos")} value={formatMoney(income)} tone="pos" />
        <Stat label={t("Egresos")} value={formatMoney(expense)} tone="neg" />
        <Stat label={t("Flujo neto")} value={formatMoney(round2(income - expense))} tone={income - expense >= 0 ? "pos" : "neg"} />
      </div>

      <Panel
        className="mb-6"
        title={t("Movimientos en el tiempo")}
        description={flow.unit === "day" ? t("Por día dentro del periodo") : t("Por mes dentro del periodo")}
        bodyClassName="p-5"
      >
        <ColumnChart
          height={180}
          series={[
            { key: "income", name: t("Ingresos"), color: "var(--chart-1)" },
            { key: "expense", name: t("Egresos"), color: "var(--chart-2)" },
          ]}
          points={flow.points.map((p) => ({ key: p.key, label: p.label, full: p.full, values: { income: p.income, expense: p.expense } }))}
          diff={{ label: t("Neto"), plus: "income", minus: "expense" }}
          emptyText={t("Sin movimientos en este periodo.")}
        />
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <form className="mb-4 flex flex-wrap items-end gap-2">
            <label>
              <span className="label">{t("Desde")}</span>
              <input type="date" name="from" defaultValue={fromStr} className="input" />
            </label>
            <label>
              <span className="label">{t("Hasta")}</span>
              <input type="date" name="to" defaultValue={toStr} className="input" />
            </label>
            <label>
              <span className="label">{t("Tipo")}</span>
              <select name="type" defaultValue={sp.type ?? ""} className="input">
                <option value="">{t("Todos")}</option>
                <option value="INGRESO">{t("Ingresos")}</option>
                <option value="EGRESO">{t("Egresos")}</option>
              </select>
            </label>
            <label>
              <span className="label">{t("Categoría")}</span>
              <select name="category" defaultValue={sp.category ?? ""} className="input">
                <option value="">{t("Todas")}</option>
                <optgroup label={t("Ingresos")}>
                  {INCOME_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{tr(c)}</option>
                  ))}
                </optgroup>
                <optgroup label={t("Egresos")}>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{tr(c)}</option>
                  ))}
                </optgroup>
              </select>
            </label>
            <label>
              <span className="label">{t("Cliente o proveedor")}</span>
              <select name="cp" defaultValue={sp.cp ?? ""} className="input max-w-56">
                <option value="">{t("Todos")}</option>
                <optgroup label={t("Clientes (ingresos)")}>
                  {clients.map((c) => (
                    <option key={c.id} value={`c${c.id}`}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label={t("Proveedores (egresos)")}>
                  {suppliers.map((s) => (
                    <option key={s.id} value={`p${s.id}`}>
                      {s.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
            <button className="btn-secondary">{t("Filtrar")}</button>
          </form>

          <div className="card overflow-x-auto">
            {txs.length === 0 ? (
              <Empty>{t("Sin movimientos en este periodo.")}</Empty>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>{t("Fecha")}</th>
                    <th>{t("Concepto")}</th>
                    <th>{t("Cliente / proveedor")}</th>
                    <th>{t("Categoría")}</th>
                    <th>{t("Método")}</th>
                    <th className="text-right">{t("Monto")}</th>
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
                            {t.description || tr("(sin concepto)")}
                          </Link>
                        )}
                      </td>
                      <td>
                        {t.client ? (
                          <Link href={`/clientes/${t.client.id}`} className="hover:text-primary hover:underline">
                            {t.client.name}
                          </Link>
                        ) : t.supplier ? (
                          <Link href={`/proveedores/${t.supplier.id}`} className="hover:text-primary hover:underline">
                            {t.supplier.name}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="text-muted-foreground">{tr(t.category)}</td>
                      <td className="text-muted-foreground">
                        {tr(t.method)}
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

        <div id="nuevo-movimiento" className="card h-fit scroll-mt-6 p-5">
          <h2 className="mb-3 font-semibold">{t("Nuevo movimiento")}</h2>
          <TransactionForm
            key={preSupplier?.id ?? "nuevo"}
            action={createTransaction}
            clients={clients}
            suppliers={suppliers}
            defaultTaxRate={settings.defaultTaxRate}
            submitLabel={tr("Registrar movimiento")}
            tx={{
              type: "EGRESO",
              category: preSupplier?.category ?? "",
              amount: 0,
              tax: 0,
              date: toInputDate(new Date()),
              description: "",
              method: "Transferencia",
              reference: "",
              clientId: null,
              supplierId: preSupplier?.id ?? null,
            }}
          />
        </div>
      </div>
    </div>
  );
}
