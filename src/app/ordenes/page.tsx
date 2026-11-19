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
  operatedDays,
  operatedWeeks,
  orderRateOf,
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

export const dynamic = "force-dynamic";
export const metadata = { title: "Órdenes diarias" };

const avg = (total: number, n: number) => (n ? total / n : 0);
const one = (n: number) => formatNumber(Math.round(n * 10) / 10);

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ fecha?: string }> }) {
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

  // Indicadores (hasta el día elegido)
  const upToWeek = date < week.to ? date : week.to;
  const upToMonth = date;
  const dayTotal = sumRange(orders, date, date);
  const prevSameDay = sumRange(orders, lastWeekSameDay, lastWeekSameDay);
  const weekTotal = sumRange(orders, week.from, week.to);
  const weekDays = operatedDays(orders, week.from, upToWeek);
  const monthTotal = sumRange(orders, month.from, month.to);
  const monthDays = operatedDays(orders, month.from, upToMonth);
  const monthWeeks = operatedWeeks(orders, month.from, upToMonth);

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
      return {
        id: c.id,
        name: c.name,
        day: sumRange(orders, date, date, c.id),
        week: w,
        weekAvg: avg(w, weekDays),
        month: m,
        monthAvg: avg(m, monthDays),
        weeklyAvg: avg(m, monthWeeks),
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
            {isToday && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary normal-case">Hoy</span>}
          </span>
        }
        actions={
          <div className="flex items-center gap-1">
            <Link href={`/ordenes?fecha=${addDaysStr(date, -1)}`} className="btn-secondary h-8 px-2" aria-label="Día anterior">
              <ChevronLeft className="size-4" />
            </Link>
            <DateJump value={date} />
            <Link href={`/ordenes?fecha=${addDaysStr(date, 1)}`} className="btn-secondary h-8 px-2" aria-label="Día siguiente">
              <ChevronRight className="size-4" />
            </Link>
            {!isToday && (
              <Link href="/ordenes" className="btn-secondary h-8 text-xs">
                Hoy
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
        <Stat label="Semana" value={formatNumber(weekTotal)} icon={CalendarRange} hint={`${one(avg(weekTotal, weekDays))} por día · ${weekDays} día(s) operado(s)`} />
        <Stat label="Mes" value={formatNumber(monthTotal)} icon={CalendarDays} hint={`${one(avg(monthTotal, monthDays))} por día · ${monthDays} día(s) operado(s)`} />
        <Stat label="Promedio semanal" value={one(avg(monthTotal, monthWeeks))} icon={TrendingUp} hint={`Paquetes por semana en ${monthName(date)}`} />
      </div>

      <Panel
        className="mb-6"
        title="Captura del día"
        description="Escribe las órdenes de cada cliente por oleada. Enter baja al siguiente cliente; las flechas mueven entre celdas."
        bodyClassName="p-0"
      >
        {waves.length === 0 ? (
          <Empty icon={Package}>Agrega al menos una oleada (abajo) para empezar a capturar.</Empty>
        ) : clients.length === 0 ? (
          <Empty icon={Package}>
            No hay clientes activos.{" "}
            <Link href="/clientes/nuevo" className="text-primary underline">
              Crear cliente
            </Link>
          </Empty>
        ) : (
          <OrderSheet key={date} date={date} waves={waves.map((w) => ({ id: w.id, name: w.name }))} clients={sheetClients} initial={initial} />
        )}
      </Panel>

      <div className="mb-6 grid gap-6 lg:grid-cols-5">
        <Panel className="lg:col-span-3" title="Tendencia" description={`Paquetes por día, del ${rangeLabel(chartFrom, date)}`} bodyClassName="p-5">
          <ColumnChart points={points} series={[{ key: "total", name: "Paquetes", color: "var(--chart-1)" }]} height={240} format="count" emptyText="Sin órdenes capturadas en estos días." />
        </Panel>
        <Panel className="lg:col-span-2" title="Mes por cliente" description={<span className="capitalize">{monthName(date)}</span>} bodyClassName="p-5">
          <BarList
            format="count"
            color="var(--chart-1)"
            total={monthTotal}
            emptyText="Sin órdenes en el mes."
            rows={withOrders.filter((s) => s.month > 0).slice(0, 8).map((s) => ({ key: String(s.id), label: s.name, value: s.month, hint: `${one(s.monthAvg)}/día` }))}
          />
        </Panel>
      </div>

      <Panel
        className="mb-6"
        title="Resumen por cliente"
        description={`Semana del ${rangeLabel(week.from, week.to)}. Los promedios diarios se calculan sobre los días operados.`}
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="table min-w-[1060px]">
            <thead>
              <tr className="text-xs text-muted-foreground [&>th]:px-3 [&>th]:py-2.5 [&>th]:font-medium">
                <th className="pl-5 text-left">Cliente</th>
                <th className="text-right">Día</th>
                <th className="text-right">Semana</th>
                <th className="text-right">Prom. diario semana</th>
                <th className="text-right">Mes</th>
                <th className="text-right">Prom. diario mes</th>
                <th className="text-right">Prom. semanal</th>
                <th className="text-right">Tarifa / paquete</th>
                <th className="text-right">Importe semana</th>
                <th className="pr-5 text-right">Resumen y factura</th>
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
                    <td className="text-right tabular-nums">{s.rate.rate ? formatMoney(amount) : <span className="text-xs text-muted-foreground">Sin tarifa</span>}</td>
                    <td className="pr-5">
                      <div className="flex items-center justify-end gap-1">
                        <a href={pdf(s.id, week.from, week.to)} target="_blank" rel="noreferrer" className="btn-secondary h-8 px-2.5 text-xs" title="PDF de la semana">
                          <FileDown className="size-3.5" />
                          Semana
                        </a>
                        <a href={pdf(s.id, month.from, month.to)} target="_blank" rel="noreferrer" className="btn-secondary h-8 px-2.5 text-xs" title="PDF del mes">
                          <FileDown className="size-3.5" />
                          Mes
                        </a>
                        {s.invoice ? (
                          <Link href={`/facturas/${s.invoice.id}`} className="btn-secondary h-8 px-2.5 text-xs text-emerald-700" title="Factura de esta semana">
                            <PackageCheck className="size-3.5" />
                            {s.invoice.folio}
                          </Link>
                        ) : s.week > 0 ? (
                          <Link href={`/facturas/nueva?ordenes=${s.id}&semana=${week.from}`} className="btn-primary h-8 px-2.5 text-xs" title="Crear la factura semanal de servicio logístico">
                            <ReceiptText className="size-3.5" />
                            Facturar
                          </Link>
                        ) : (
                          <span className="inline-flex h-8 w-[5.6rem] items-center justify-center text-xs text-muted-foreground">Sin órdenes</span>
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
                <input name="name" defaultValue={w.name} aria-label="Nombre de la oleada" className="input h-8 max-w-80" required />
                <SubmitButton className="btn-secondary h-8 text-xs">Renombrar</SubmitButton>
              </Form>
              <div className="flex items-center gap-1">
                <Form action={moveWave.bind(null, w.id)}>
                  <input type="hidden" name="dir" value="-1" />
                  <button className="btn-secondary h-8 px-2" aria-label="Mover a la izquierda" disabled={i === 0}>
                    <ArrowUp className="size-3.5" />
                  </button>
                </Form>
                <Form action={moveWave.bind(null, w.id)}>
                  <input type="hidden" name="dir" value="1" />
                  <button className="btn-secondary h-8 px-2" aria-label="Mover a la derecha" disabled={i === waves.length - 1}>
                    <ArrowDown className="size-3.5" />
                  </button>
                </Form>
                <Form action={toggleWave.bind(null, w.id)}>
                  <button className="btn-secondary h-8 px-2.5 text-xs">
                    <EyeOff className="size-3.5" />
                    Ocultar
                  </button>
                </Form>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <Form action={addWave} resetOnSuccess className="flex w-full max-w-md items-center gap-2">
            <input name="name" placeholder="Nueva oleada (ej. Primer Oleada Shein)" aria-label="Nueva oleada" className="input h-9" required />
            <SubmitButton className="btn-primary">
              <Plus className="size-4" />
              Agregar
            </SubmitButton>
          </Form>
          {hiddenWaves.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Ocultas:</span>
              {hiddenWaves.map((w) => (
                <Form key={w.id} action={toggleWave.bind(null, w.id)}>
                  <button className="btn-secondary h-7 px-2 text-xs" title="Mostrar de nuevo">
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
