import { formatCurrency } from "@/lib/currency";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, FileText, Plus, Receipt, ReceiptText, Wallet, ClipboardList, Activity } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader, Stat, StatusBadge, Empty, Panel } from "@/components/kit";
import { ActivityHeatmap, BarList, ColumnChart, Delta, SegmentedBar } from "@/components/charts";
import { ActivityFeed } from "@/components/ActivityFeed";
import { formatDate, formatMoney, round2 } from "@/lib/money";
import { AGING_BUCKETS, incomeStatement, parseRange, payables, receivables } from "@/lib/reports";
import { AGING_LABEL, activityByDay, flowSeries, lastMonthsRange, pctChange, quotePipeline, recentActivity, topClients } from "@/lib/insights";
import { getSettings } from "@/lib/settings";
import { getLang, getT } from "@/lib/i18n/server";
import { localeOf } from "@/lib/i18n";
import { NoAccessNotice } from "@/components/NoAccessNotice";
import { canManageUsers, getSessionUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";

/** Solo las columnas que muestran las tablas de "Últimas facturas/cotizaciones". */
const RECENT_SELECT = { id: true, folio: true, issueDate: true, status: true, total: true, client: { select: { name: true } } } as const;

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ sinpermiso?: string }> }) {
  const [t, lang, settings, sp, me] = await Promise.all([getT(), getLang(), getSettings(), searchParams, getSessionUser()]);
  // El aviso solo aplica a roles con secciones restringidas (nunca a la cuenta maestra ni a administradores)
  // El repartidor solo usa la app de reparto
  if (me?.role === "REPARTIDOR") redirect("/reparto");
  const showNoAccess = !!sp.sinpermiso && !!me && !canManageUsers(me.role);
  const locale = localeOf(lang);
  const { from, to } = parseRange();
  const prevFrom = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - 1, 1));
  const prevTo = new Date(from.getTime() - 1);
  const year = lastMonthsRange(12);
  const [stmt, prev, ar, ap, openQuotes, recentInvoices, recentQuotes, flow, pipeline, clients, activity, heat] = await Promise.all([
    incomeStatement(from, to),
    incomeStatement(prevFrom, prevTo),
    receivables(),
    payables(),
    // Suma y conteo en la base (antes se traían todas las cotizaciones abiertas para sumarlas aquí)
    prisma.quote.aggregate({ where: { status: { in: ["BORRADOR", "ENVIADA", "ACEPTADA"] } }, _sum: { total: true }, _count: { _all: true } }),
    prisma.invoice.findMany({ orderBy: { id: "desc" }, take: 6, select: { ...RECENT_SELECT, currency: true } }),
    prisma.quote
      .findMany({ orderBy: { id: "desc" }, take: 6, select: { ...RECENT_SELECT, prospectName: true } })
      .then((qs) => qs.map((q) => ({ ...q, currency: "MXN", client: { name: q.client?.name ?? `${q.prospectName || t("Prospecto")} (${t("prospecto")})` } }))),
    flowSeries(year.from, year.to, locale),
    quotePipeline(),
    topClients(year.from, year.to),
    recentActivity(9),
    activityByDay(17, settings.timezone || "America/Mexico_City"),
  ]);
  const openTotal = round2(openQuotes._sum.total ?? 0);
  const overdue = round2(ar.total - ar.byBucket.corriente);
  const apOverdue = round2(ap.total - ap.byBucket.corriente);
  const monthName = from.toLocaleDateString(locale, { month: "long", year: "numeric", timeZone: "UTC" });
  const net = round2(stmt.incomeTotal - stmt.expenseTotal);
  const yearIncome = round2(flow.points.reduce((a, p) => a + p.income, 0));
  const yearExpense = round2(flow.points.reduce((a, p) => a + p.expense, 0));
  const clientsTotal = round2(clients.reduce((a, c) => a + c.total, 0));

  // Embudo: de las cotizaciones que ya se decidieron, cuántas se ganaron.
  const won = (pipeline.ACEPTADA?.count ?? 0) + (pipeline.FACTURADA?.count ?? 0);
  const decided = won + (pipeline.RECHAZADA?.count ?? 0);
  const winRate = decided ? Math.round((won / decided) * 100) : null;
  const QUOTE_PARTS = [
    { key: "BORRADOR", name: t("Borrador"), color: "var(--chart-5)", ink: "dark" as const },
    { key: "ENVIADA", name: t("Enviada"), color: "var(--chart-1)" },
    { key: "ACEPTADA", name: t("Aceptada"), color: "var(--chart-3)" },
    { key: "FACTURADA", name: t("Facturada"), color: "var(--chart-4)" },
    { key: "RECHAZADA", name: t("Rechazada"), color: "var(--chart-2)" },
  ];

  return (
    <div>
      {showNoAccess && <NoAccessNotice />}
      <PageHeader
        title={t("Inicio")}
        subtitle={
          <>
            {t("Resumen de")} <span className="font-medium text-foreground">{monthName}</span> · {t("utilidad del mes")}{" "}
            <span className={net >= 0 ? "font-medium text-emerald-700" : "font-medium text-rose-700"}>{formatMoney(net)}</span>
          </>
        }
        actions={
          <>
            <Link href="/cotizaciones/nueva" className="btn-secondary">
              <FileText className="size-4" /> {t("Nueva cotización")}
            </Link>
            <Link href="/facturas/nueva" className="btn-primary">
              <Plus className="size-4" /> {t("Nueva factura")}
            </Link>
          </>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <Stat
          label={t("Ingresos del mes")}
          value={formatMoney(stmt.incomeTotal)}
          tone="pos"
          icon={ArrowUpRight}
          href="/contabilidad"
          delta={<Delta pct={pctChange(stmt.incomeTotal, prev.incomeTotal)} />}
          hint={t("vs. mes anterior")}
        />
        <Stat
          label={t("Egresos del mes")}
          value={formatMoney(stmt.expenseTotal)}
          tone="neg"
          icon={ArrowDownRight}
          href="/contabilidad"
          delta={<Delta pct={pctChange(stmt.expenseTotal, prev.expenseTotal)} goodWhenUp={false} />}
          hint={t("vs. mes anterior")}
        />
        <Stat
          label={t("Por cobrar")}
          value={formatMoney(ar.total)}
          hint={overdue > 0 ? t("{amount} vencido", { amount: formatMoney(overdue) }) : t("Todo al corriente")}
          icon={Wallet}
          href={overdue > 0 ? "/facturas?status=VENCIDA" : "/facturas"}
        />
        <Stat
          label={t("Por pagar")}
          value={formatMoney(ap.total)}
          tone={apOverdue > 0 ? "neg" : undefined}
          hint={apOverdue > 0 ? t("{amount} vencido", { amount: formatMoney(apOverdue) }) : ap.total > 0 ? t("Todo al corriente") : t("Sin cuentas pendientes")}
          icon={Receipt}
          href={apOverdue > 0 ? "/cuentas-por-pagar?status=VENCIDA" : "/cuentas-por-pagar"}
        />
        <Stat label={t("Cotizaciones abiertas")} value={formatMoney(openTotal)} hint={t("{n} en seguimiento", { n: openQuotes._count._all })} icon={ClipboardList} href="/cotizaciones" />
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title={t("Flujo de efectivo")}
          description={
            <>
              {t("Últimos 12 meses")} · {t("ingresos")} <span className="font-medium text-foreground tabular-nums">{formatMoney(yearIncome)}</span> · {t("egresos")}{" "}
              <span className="font-medium text-foreground tabular-nums">{formatMoney(yearExpense)}</span>
            </>
          }
          action={
            <Link href="/contabilidad/reportes" className="group/link inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
              {t("Reportes")} <ArrowRight className="size-3.5 transition-transform duration-(--dur-state) ease-(--ease-out) group-hover/link:translate-x-0.5" />
            </Link>
          }
          bodyClassName="p-5"
        >
          <ColumnChart
            height={290}
            series={[
              { key: "income", name: t("Ingresos"), color: "var(--chart-1)" },
              { key: "expense", name: t("Egresos"), color: "var(--chart-2)" },
            ]}
            points={flow.points.map((p) => ({ key: p.key, label: p.label, full: p.full, values: { income: p.income, expense: p.expense } }))}
            diff={{ label: t("Neto"), plus: "income", minus: "expense" }}
            emptyText={t("Aún no hay movimientos registrados.")}
          />
        </Panel>

        <div className="grid gap-6">
          <Panel
            title={t("Cuentas por cobrar")}
            description={t("{n} factura(s) con saldo · {amount}", { n: ar.rows.length, amount: formatMoney(ar.total) })}
            bodyClassName="p-5"
          >
            <SegmentedBar
              emptyText={t("Sin saldos pendientes")}
              parts={AGING_BUCKETS.map((b, i) => ({
                key: b,
                name: t(AGING_LABEL[b]!),
                value: ar.byBucket[b],
                color: `var(--aging-${i})`,
                ink: i === 1 ? ("dark" as const) : undefined,
                href: "/contabilidad/reportes",
              }))}
            />
          </Panel>
          <Panel
            title={t("Embudo de cotizaciones")}
            description={winRate === null ? t("Importe por estado") : t("Tasa de cierre {pct}% ({won} de {n} decididas)", { pct: winRate, won, n: decided })}
            bodyClassName="p-5"
          >
            <SegmentedBar
              emptyText={t("Aún no hay cotizaciones")}
              parts={QUOTE_PARTS.map((p) => ({
                ...p,
                value: pipeline[p.key]?.total ?? 0,
                hint: String(pipeline[p.key]?.count ?? 0),
                href: `/cotizaciones?status=${p.key}`,
              }))}
            />
          </Panel>
        </div>
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title={t("Actividad reciente")}
          description={t("{n} registros capturados en las últimas 17 semanas", { n: heat.total })}
          bodyClassName="divide-y"
        >
          <div className="px-5 py-4">
            <ActivityHeatmap days={heat.days} />
          </div>
          {activity.length === 0 ? (
            <Empty icon={Activity}>{t("Aquí verás cada factura, cotización, pago y movimiento conforme se registren.")}</Empty>
          ) : (
            <div className="py-2">
              <ActivityFeed items={activity} now={Date.now()} />
            </div>
          )}
        </Panel>

        <Panel title={t("Clientes principales")} description={t("Facturado en los últimos 12 meses")} bodyClassName="p-5">
          <BarList
            color="var(--chart-1)"
            total={clientsTotal}
            emptyText={t("Aún no hay facturas en este periodo.")}
            rows={clients.map((c) => ({ key: String(c.id), label: c.name, value: c.total, href: `/clientes/${c.id}`, hint: `${c.count}` }))}
          />
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {(
          [
            [t("Últimas facturas"), "/facturas", recentInvoices, ReceiptText, "/facturas/nueva"],
            [t("Últimas cotizaciones"), "/cotizaciones", recentQuotes, FileText, "/cotizaciones/nueva"],
          ] as const
        ).map(([title, href, rows, Icon, newHref]) => (
          <Panel
            key={title}
            title={t(title)}
            action={
              <Link href={href} className="group/link inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
                {t("Ver todas")} <ArrowRight className="size-3.5 transition-transform duration-(--dur-state) ease-(--ease-out) group-hover/link:translate-x-0.5" />
              </Link>
            }
          >
            {rows.length === 0 ? (
              <Empty
                icon={Icon}
                action={
                  <Link href={newHref} className="btn-secondary">
                    <Plus className="size-4" /> {t("Crear")}
                  </Link>
                }
              >
                {t("Nada por aquí todavía.")}
              </Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <Link href={`${href}/${r.id}`} className="font-medium text-primary hover:underline">
                            {r.folio}
                          </Link>
                          <div className="text-xs text-muted-foreground">{formatDate(r.issueDate)}</div>
                        </td>
                        <td className="max-w-48 truncate">{r.client.name}</td>
                        <td>
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="text-right font-medium tabular-nums">{formatCurrency(r.total, r.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        ))}
      </div>
    </div>
  );
}
