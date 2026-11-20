import Link from "next/link";
import { ArrowDown, ArrowUp, CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Eye, EyeOff, FileDown, Package, PackageCheck, Plus, ReceiptText, TrendingUp } from "lucide-react";
import { prisma } from "@/lib/db";
import { addDaysStr } from "@/lib/attendance";
import {
  DATE_RE,
  companyToday,
  dayLong,
  dayShort,
  monthEndOf,
  monthName,
  monthStartOf,
  orderRateOf,
  weekSegments,
  weeklyAverages,
  workdaysBetween,
  rangeLabel,
  sumRange,
  totalsByDay,
  weekOf,
  daysBetween,
} from "@/lib/orders";
import { formatMoney, formatNumber } from "@/lib/money";
import { pctChange } from "@/lib/insights";
import { addWave, moveWave, renameWave, toggleWave } from "@/app/actions/orders";
import { PageHeader, Panel, Stat, Empty } from "@/components/kit";
import { BarList, ColumnChart, Delta } from "@/components/charts";
import { DateJump, OrderSheet, RateInput } from "@/components/OrderSheet";
import { Form } from "@/components/Form";
import { SubmitButton } from "@/components/SubmitButton";
import { OrdersTabs } from "@/components/OrdersTabs";
import { Tr } from "@/components/Tr";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await getT())("Órdenes diarias") };
}

const avg = (total: number, n: number) => (n ? total / n : 0);
const one = (n: number) => formatNumber(Math.round(n * 10) / 10);

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ fecha?: string }> }) {
  const t = await getT();
  const today = await companyToday();
  const { fecha } = await searchParams;
  const date = fecha && DATE_RE.test(fecha) ? fecha : today;
  const week = weekOf(date);
  const month = { from: monthStartOf(date), to: monthEndOf(date) };
  const chartFrom = addDaysStr(date, -34);
  const lastWeekSameDay = addDaysStr(date, -7);
  const from = [week.from, month.from, chartFrom].sort()[0]!;
  const to = [week.to, month.to].sort().at(-1)!;

  const [waves, hiddenWaves, clients, orders, invoices] = await Promise.all([
    prisma.orderWave.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
    prisma.orderWave.findMany({ where: { active: false }, orderBy: { name: "asc" } }),
    prisma.client.findMany({
      where: { OR: [{ active: true }, { dailyOrders: { some: { workDate: { gte: month.from, lte: month.to } } } }] },
      select: { id: true, name: true, orderRate: true, rates: { select: { name: true, wmsConcept: true, unitPrice: true, active: true, atCost: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.dailyOrder.findMany({ where: { workDate: { gte: from, lte: to }, quantity: { gt: 0 } }, select: { workDate: true, clientId: true, waveId: true, quantity: true } }),
    prisma.invoice.findMany({ where: { ordersWeek: week.from, status: { not: "CANCELADA" } }, select: { id: true, folio: true, clientId: true } }),
  ]);

  // Captura del día
  const initial: Record<string, number> = {};
  for (const o of orders) if (o.workDate === date) initial[`${o.clientId}:${o.waveId}`] = o.quantity;
  const sheetClients = clients.map((c) => ({
    id: c.id,
    name: c.name,
    // Lo de la semana sin el día capturado: la hoja le suma el día en vivo.
    weekOther: sumRange(orders, week.from, week.to, c.id) - sumRange(orders, date, date, c.id),
  }));

  // Indicadores (hasta el día elegido). Semanas de lunes a sábado; el mes se parte en semanas
  // (la primera y la última pueden quedar cortadas) y su promedio sale del de cada semana.
  const dayTotal = sumRange(orders, date, date);
  const prevSameDay = sumRange(orders, lastWeekSameDay, lastWeekSameDay);
  const weekTotal = sumRange(orders, week.from, week.to);
  const weekDays = workdaysBetween(week.from, week.to, date);
  const monthTotal = sumRange(orders, month.from, month.to);
  const monthSegments = weekSegments(month.from, month.to, date);
  const monthStats = weeklyAverages(orders, monthSegments);

  // Últimos 35 días (tendencia)
  const byDay = totalsByDay(orders);
  const points = daysBetween(chartFrom, date).map((d) => ({
    key: d,
    label: String(Number(d.slice(8))),
    full: dayShort(d),
    values: { total: byDay.get(d) ?? 0 },
  }));

  // Resumen por cliente
  const invoiceOf = new Map(invoices.map((i) => [i.clientId, i]));
  const summary = clients
    .map((c) => {
      const w = sumRange(orders, week.from, week.to, c.id);
      const m = sumRange(orders, month.from, month.to, c.id);
      const rate = orderRateOf(c);
      const ms = weeklyAverages(orders, monthSegments, c.id);
      return {
        id: c.id,
        name: c.name,
        day: sumRange(orders, date, date, c.id),
        week: w,
        weekAvg: avg(w, weekDays),
        month: m,
        monthAvg: ms.dailyAvg,
        weeklyAvg: ms.weeklyAvg,
        orderRate: c.orderRate,
        rate,
        invoice: invoiceOf.get(c.id),
      };
    })
    .sort((a, b) => b.month - a.month || a.name.localeCompare(b.name));
  const withOrders = summary.filter((s) => s.month > 0 || s.week > 0);
  const pdf = (id: number, f: string, t: string) => `/api/pdf/ordenes/${id}?desde=${f}&hasta=${t}`;
  const isToday = date === today;

  return (
    <div>
      <PageHeader
        title="Órdenes diarias"
        subtitle={
          <span className="capitalize">
            {dayLong(date)}
            {isToday && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary normal-case"><Tr>Hoy</Tr></span>}
          </span>
        }
        actions={
          <div className="flex items-center gap-1">
            <Link href={`/ordenes?fecha=${addDaysStr(date, -1)}`} className="btn-secondary h-8 px-2" aria-label={t("Día anterior")}>
              <ChevronLeft className="size-4" />
            </Link>
            <DateJump value={date} />
            <Link href={`/ordenes?fecha=${addDaysStr(date, 1)}`} className="btn-secondary h-8 px-2" aria-label={t("Día siguiente")}>
              <ChevronRight className="size-4" />
            </Link>
            {!isToday && (
              <Link href="/ordenes" className="btn-secondary h-8 text-xs">
                <Tr>Hoy</Tr>
              </Link>
            )}
          </div>
        }
      />

      <OrdersTabs active="ordenes" date={date} />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat
          label="Paquetes del día"
          value={formatNumber(dayTotal)}
          icon={Package}
          delta={prevSameDay ? <Delta pct={pctChange(dayTotal, prevSameDay)} label={`vs. ${dayShort(lastWeekSameDay)}`} /> : undefined}
          hint={prevSameDay ? undefined : "Total de todos los clientes"}
        />
        <Stat label="Semana" value={formatNumber(weekTotal)} icon={CalendarRange} hint={t("{v0} por día · {v1} día(s) de lunes a sábado", { v0: one(avg(weekTotal, weekDays)), v1: weekDays })} />
        <Stat label="Mes" value={formatNumber(monthTotal)} icon={CalendarDays} hint={t("{v0} por día · promedio de {v1} semana(s)", { v0: one(monthStats.dailyAvg), v1: monthStats.counted })} />
        <Stat label="Promedio semanal" value={one(monthStats.weeklyAvg)} icon={TrendingUp} hint={t("Paquetes por semana en {v0}", { v0: monthName(date) })} />
      </div>

      <Panel
        className="mb-6"
        title="Captura del día"
        description="Escribe las órdenes de cada cliente por oleada. Enter baja al siguiente cliente; las flechas mueven entre celdas."
        bodyClassName="p-0"
      >
        {waves.length === 0 ? (
          <Empty icon={Package}><Tr>Agrega al menos una oleada (abajo) para empezar a capturar.</Tr></Empty>
        ) : clients.length === 0 ? (
          <Empty icon={Package}>
            <Tr>No hay clientes activos.</Tr>{" "}
            <Link href="/clientes/nuevo" className="text-primary underline">
              <Tr>Crear cliente</Tr>
            </Link>
          </Empty>
        ) : (
          <OrderSheet key={date} date={date} waves={waves.map((w) => ({ id: w.id, name: w.name }))} clients={sheetClients} initial={initial} />
        )}
      </Panel>

      <div className="mb-6 grid gap-6 lg:grid-cols-5">
        <Panel className="lg:col-span-3" title="Tendencia" description={t("Paquetes por día, del {v0}", { v0: rangeLabel(chartFrom, date) })} bodyClassName="p-5">
          <ColumnChart points={points} series={[{ key: "total", name: t("Paquetes"), color: "var(--chart-1)" }]} height={240} format="count" emptyText={t("Sin órdenes capturadas en estos días.")} />
        </Panel>
        <Panel className="lg:col-span-2" title="Mes por cliente" description={<span className="capitalize">{monthName(date)}</span>} bodyClassName="p-5">
          <BarList
            format="count"
            color="var(--chart-1)"
            total={monthTotal}
            emptyText={t("Sin órdenes en el mes.")}
            rows={withOrders.filter((s) => s.month > 0).slice(0, 8).map((s) => ({ key: String(s.id), label: s.name, value: s.month, hint: `${one(s.monthAvg)}/día` }))}
          />
        </Panel>
      </div>

      <Panel
        className="mb-6"
        title="Semanas del mes"
        description={
          <>
            <Tr>Semanas de lunes a sábado; la primera y la última pueden quedar cortadas por el cambio de mes. El promedio del mes es el promedio de los promedios de cada semana.</Tr>
          </>
        }
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="table min-w-[560px]">
            <thead>
              <tr className="text-xs text-muted-foreground [&>th]:px-3 [&>th]:py-2.5 [&>th]:font-medium">
                <th className="pl-5 text-left"><Tr>Semana</Tr></th>
                <th className="text-right"><Tr>Días lun–sáb</Tr></th>
                <th className="text-right"><Tr>Paquetes</Tr></th>
                <th className="w-[38%] pr-5 text-right"><Tr>Promedio diario</Tr></th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const maxAvg = Math.max(1, ...monthStats.weeks.map((w) => w.dailyAvg));
                return monthStats.weeks.map((w, i) => {
                  const current = date >= w.from && date <= w.to;
                  const pending = w.workdays === 0;
                  return (
                    <tr key={w.from} className={`border-t [&>td]:px-3 [&>td]:py-2 ${current ? "bg-primary/[0.04]" : ""}`}>
                      <td className="pl-5">
                        <span className="font-medium">{rangeLabel(w.from, w.to)}</span>
                        {current && <span className="ml-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary"><Tr>En curso</Tr></span>}
                        {workdaysBetween(w.from, w.to) < 6 && !pending && <span className="ml-2 text-xs text-muted-foreground"><Tr>cortada</Tr></span>}
                      </td>
                      <td className="text-right tabular-nums">{pending ? <span className="text-muted-foreground">—</span> : w.workdays}</td>
                      <td className="text-right font-medium tabular-nums">{pending ? <span className="text-muted-foreground">—</span> : formatNumber(w.total)}</td>
                      <td className="pr-5">
                        {pending ? (
                          <span className="block text-right text-xs text-muted-foreground">{w.from > date ? t("Aún no empieza") : t("Sin días lun–sáb")}</span>
                        ) : (
                          <div className="flex items-center justify-end gap-3">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                              <div
                                className="viz-grow-right h-full rounded-full"
                                style={{ width: `${(w.dailyAvg / maxAvg) * 100}%`, background: "var(--chart-1)", "--viz-delay": `${Math.min(i * 30, 160)}ms` } as React.CSSProperties}
                              />
                            </div>
                            <span className="w-14 text-right font-semibold tabular-nums">{one(w.dailyAvg)}</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                });
              })()}
              <tr className="border-t bg-muted font-semibold [&>td]:px-3 [&>td]:py-2.5">
                <td className="pl-5">
                  <Tr>Promedio del mes</Tr> <span className="font-normal text-muted-foreground">· {monthStats.counted} <Tr>semana(s)</Tr></span>
                </td>
                <td />
                <td className="text-right tabular-nums" title={t("Promedio de los totales semanales")}>
                  {one(monthStats.weeklyAvg)} <span className="text-xs font-normal text-muted-foreground">/ <Tr>semana</Tr></span>
                </td>
                <td className="pr-5 text-right tabular-nums">
                  {one(monthStats.dailyAvg)} <span className="text-xs font-normal text-muted-foreground">/ <Tr>día</Tr></span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        className="mb-6"
        title="Resumen por cliente"
        description={t("Semana del {v0}. Promedios con semanas de lunes a sábado; el del mes es el promedio de sus semanas.", { v0: rangeLabel(week.from, week.to) })}
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="table min-w-[1060px]">
            <thead>
              <tr className="text-xs text-muted-foreground [&>th]:px-3 [&>th]:py-2.5 [&>th]:font-medium">
                <th className="pl-5 text-left"><Tr>Cliente</Tr></th>
                <th className="text-right"><Tr>Día</Tr></th>
                <th className="text-right"><Tr>Semana</Tr></th>
                <th className="text-right"><Tr>Prom. diario semana</Tr></th>
                <th className="text-right"><Tr>Mes</Tr></th>
                <th className="text-right"><Tr>Prom. diario mes</Tr></th>
                <th className="text-right"><Tr>Prom. semanal</Tr></th>
                <th className="text-right"><Tr>Tarifa / paquete</Tr></th>
                <th className="text-right"><Tr>Importe semana</Tr></th>
                <th className="pr-5 text-right"><Tr>Resumen y factura</Tr></th>
              </tr>
            </thead>
            <tbody>
              {summary.map((s) => {
                const amount = s.week * s.rate.rate;
                return (
                  <tr key={s.id} className="border-t transition-colors hover:bg-muted/40 [&>td]:px-3 [&>td]:py-2">
                    <td className="pl-5 font-medium">{s.name}</td>
                    <td className="text-right tabular-nums">{s.day ? formatNumber(s.day) : <span className="text-muted-foreground/50">0</span>}</td>
                    <td className="text-right font-medium tabular-nums">{formatNumber(s.week)}</td>
                    <td className="text-right text-muted-foreground tabular-nums">{one(s.weekAvg)}</td>
                    <td className="text-right font-medium tabular-nums">{formatNumber(s.month)}</td>
                    <td className="text-right text-muted-foreground tabular-nums">{one(s.monthAvg)}</td>
                    <td className="text-right text-muted-foreground tabular-nums">{one(s.weeklyAvg)}</td>
                    <td className="text-right">
                      <RateInput clientId={s.id} value={s.orderRate} fallback={s.rate.source === "tarifa" ? s.rate.rate : 0} fallbackLabel={s.rate.label} />
                    </td>
                    <td className="text-right tabular-nums">{s.rate.rate ? formatMoney(amount) : <span className="text-xs text-muted-foreground"><Tr>Sin tarifa</Tr></span>}</td>
                    <td className="pr-5">
                      <div className="flex items-center justify-end gap-1">
                        <a href={pdf(s.id, week.from, week.to)} target="_blank" rel="noreferrer" className="btn-secondary h-8 px-2.5 text-xs" title={t("PDF de la semana")}>
                          <FileDown className="size-3.5" />
                          <Tr>Semana</Tr>
                        </a>
                        <a href={pdf(s.id, month.from, month.to)} target="_blank" rel="noreferrer" className="btn-secondary h-8 px-2.5 text-xs" title={t("PDF del mes")}>
                          <FileDown className="size-3.5" />
                          <Tr>Mes</Tr>
                        </a>
                        {s.invoice ? (
                          <Link href={`/facturas/${s.invoice.id}`} className="btn-secondary h-8 px-2.5 text-xs text-emerald-700" title={t("Factura de esta semana")}>
                            <PackageCheck className="size-3.5" />
                            {s.invoice.folio}
                          </Link>
                        ) : s.week > 0 ? (
                          <Link href={`/facturas/nueva?ordenes=${s.id}&semana=${week.from}`} className="btn-primary h-8 px-2.5 text-xs" title={t("Crear la factura semanal de servicio logístico")}>
                            <ReceiptText className="size-3.5" />
                            <Tr>Facturar</Tr>
                          </Link>
                        ) : (
                          <span className="inline-flex h-8 w-[5.6rem] items-center justify-center text-xs text-muted-foreground"><Tr>Sin órdenes</Tr></span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Oleadas" description="Son las columnas de la captura. Ocultar una oleada no borra sus órdenes: siguen contando en totales, PDFs y facturas." bodyClassName="p-5">
        <ul className="divide-y rounded-lg border">
          {waves.map((w, i) => (
            <li key={w.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <Form action={renameWave.bind(null, w.id)} className="flex min-w-0 flex-1 items-center gap-2">
                <input name="name" defaultValue={w.name} aria-label={t("Nombre de la oleada")} className="input h-8 max-w-80" required />
                <SubmitButton className="btn-secondary h-8 text-xs"><Tr>Renombrar</Tr></SubmitButton>
              </Form>
              <div className="flex items-center gap-1">
                <Form action={moveWave.bind(null, w.id)}>
                  <input type="hidden" name="dir" value="-1" />
                  <button className="btn-secondary h-8 px-2" aria-label={t("Mover a la izquierda")} disabled={i === 0}>
                    <ArrowUp className="size-3.5" />
                  </button>
                </Form>
                <Form action={moveWave.bind(null, w.id)}>
                  <input type="hidden" name="dir" value="1" />
                  <button className="btn-secondary h-8 px-2" aria-label={t("Mover a la derecha")} disabled={i === waves.length - 1}>
                    <ArrowDown className="size-3.5" />
                  </button>
                </Form>
                <Form action={toggleWave.bind(null, w.id)}>
                  <button className="btn-secondary h-8 px-2.5 text-xs">
                    <EyeOff className="size-3.5" />
                    <Tr>Ocultar</Tr>
                  </button>
                </Form>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <Form action={addWave} resetOnSuccess className="flex w-full max-w-md items-center gap-2">
            <input name="name" placeholder={t("Nueva oleada (ej. Primer Oleada Shein)")} aria-label={t("Nueva oleada")} className="input h-9" required />
            <SubmitButton className="btn-primary">
              <Plus className="size-4" />
              <Tr>Agregar</Tr>
            </SubmitButton>
          </Form>
          {hiddenWaves.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground"><Tr>Ocultas:</Tr></span>
              {hiddenWaves.map((w) => (
                <Form key={w.id} action={toggleWave.bind(null, w.id)}>
                  <button className="btn-secondary h-7 px-2 text-xs" title={t("Mostrar de nuevo")}>
                    <Eye className="size-3.5" />
                    {w.name}
                  </button>
                </Form>
              ))}
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
