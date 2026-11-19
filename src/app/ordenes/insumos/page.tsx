import Link from "next/link";
import { ArrowDown, ArrowUp, Boxes, CircleDollarSign, ChevronLeft, ChevronRight, CircleCheck, Eye, EyeOff, Package, Plus, TriangleAlert } from "lucide-react";
import { prisma } from "@/lib/db";
import { addDaysStr } from "@/lib/attendance";
import { DATE_RE, companyToday, dayLong, dayShort, daysBetween, monthEndOf, monthName, monthStartOf } from "@/lib/orders";
import { formatMoney, formatNumber } from "@/lib/money";
import { marginPct, supplyCost, supplySale } from "@/lib/supplies";
import { addMaterial, moveMaterial, toggleMaterial, updateMaterial } from "@/app/actions/supplies";
import { PageHeader, Panel, Stat, Empty } from "@/components/kit";
import { BarList } from "@/components/charts";
import { DateJump, NavSelect, OrderSheet } from "@/components/OrderSheet";
import { OrdersTabs, ViewSwitch } from "@/components/OrdersTabs";
import { Form } from "@/components/Form";
import { SubmitButton } from "@/components/SubmitButton";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Insumos de empaque" };

type Row = { workDate: string; clientId: number; quantity: number };
const MONTH_RE = /^\d{4}-\d{2}$/;
const sizeLabel = (size: string) => size.replace(/\s*\/\s*/g, " / ").replace(/\*/g, "×");

export default async function SuppliesPage({ searchParams }: { searchParams: Promise<{ fecha?: string; vista?: string; cliente?: string; mes?: string }> }) {
  const today = await companyToday();
  const q = await searchParams;
  const date = q.fecha && DATE_RE.test(q.fecha) ? q.fecha : today;
  const view = q.vista === "cliente" ? "cliente" : "dia";
  const monthKey = view === "cliente" && q.mes && MONTH_RE.test(q.mes) ? q.mes : date.slice(0, 7);
  const month = { from: `${monthKey}-01`, to: monthEndOf(`${monthKey}-01`) };

  const [materials, hidden, clients, supplies, orders] = await Promise.all([
    prisma.packMaterial.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
    prisma.packMaterial.findMany({ where: { active: false }, orderBy: { name: "asc" } }),
    prisma.client.findMany({
      where: { OR: [{ active: true }, { dailySupplies: { some: { workDate: { gte: month.from, lte: month.to } } } }] },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.dailySupply.findMany({
      where: { OR: [{ workDate: { gte: month.from, lte: month.to } }, { workDate: date }], quantity: { gt: 0 } },
      select: { workDate: true, clientId: true, materialId: true, quantity: true },
    }),
    prisma.dailyOrder.findMany({
      where: { OR: [{ workDate: { gte: month.from, lte: month.to } }, { workDate: date }], quantity: { gt: 0 } },
      select: { workDate: true, clientId: true, quantity: true },
    }),
  ]);

  const sum = (rows: Row[], f: (r: Row) => boolean) => rows.reduce((a, r) => (f(r) ? a + r.quantity : a), 0);
  const noSupplyIds = new Set([...materials, ...hidden].filter((m) => m.noSupply).map((m) => m.id));
  const matById = new Map([...materials, ...hidden].map((m) => [m.id, m]));
  /** Costo y venta de un conjunto de renglones de insumos. */
  const money = (rows: { materialId: number; quantity: number }[]) =>
    rows.reduce(
      (a, r) => {
        const m = matById.get(r.materialId);
        return m ? { cost: a.cost + supplyCost(r.quantity, m), sale: a.sale + supplySale(r.quantity, m) } : a;
      },
      { cost: 0, sale: 0 },
    );
  const moneyHint = (x: { cost: number; sale: number }) => {
    const pct = marginPct(x.sale, x.cost);
    return x.sale ? `Venta ${formatMoney(x.sale)} · margen ${pct}%` : "Sin precio de venta: va incluido en el servicio";
  };
  const allMaterials = [...materials, ...hidden.filter((h) => supplies.some((s) => s.materialId === h.id && s.workDate >= month.from && s.workDate <= month.to))];

  const switchItems = [
    { id: "dia", label: "Por día", href: `/ordenes/insumos?fecha=${date}` },
    { id: "cliente", label: "Por cliente", href: `/ordenes/insumos?vista=cliente&fecha=${date}&mes=${monthKey}${q.cliente ? `&cliente=${q.cliente}` : ""}` },
  ];

  return (
    <div>
      <PageHeader
        title="Insumos de empaque"
        subtitle="Bolsas y cajas usadas por cliente. Cada paquete lleva un empaque o se registra como «Sin insumo», para cuadrar contra las órdenes del día."
        actions={<ViewSwitch items={switchItems} active={view} />}
      />
      <OrdersTabs active="insumos" date={date} />
      {view === "dia" ? (
        <DayView />
      ) : (
        <ClientView />
      )}
    </div>
  );

  // ───────────────────────────── Por día ─────────────────────────────
  function DayView() {
    const isToday = date === today;
    const initial: Record<string, number> = {};
    for (const s of supplies) if (s.workDate === date) initial[`${s.clientId}:${s.materialId}`] = s.quantity;
    const dayOrders = (c: number) => sum(orders, (o) => o.workDate === date && o.clientId === c);
    const daySupply = (c: number) => sum(supplies as Row[], (s) => s.workDate === date && s.clientId === c);
    const sheetClients = clients.map((c) => ({ id: c.id, name: c.name, weekOther: 0, orders: dayOrders(c.id) }));

    const piecesDay = supplies.filter((s) => s.workDate === date && !noSupplyIds.has(s.materialId)).reduce((a, s) => a + s.quantity, 0);
    const noSupplyDay = supplies.filter((s) => s.workDate === date && noSupplyIds.has(s.materialId)).reduce((a, s) => a + s.quantity, 0);
    const ordersDay = sum(orders, (o) => o.workDate === date);
    const dayMoney = money(supplies.filter((s) => s.workDate === date));
    const active = clients.filter((c) => dayOrders(c.id) || daySupply(c.id));
    const matched = active.filter((c) => dayOrders(c.id) === daySupply(c.id)).length;

    // Consumo del mes (cliente × material), como la hoja mensual
    const inMonth = supplies.filter((s) => s.workDate >= month.from && s.workDate <= month.to);
    const cell = (c: number, m: number) => inMonth.reduce((a, s) => (s.clientId === c && s.materialId === m ? a + s.quantity : a), 0);
    const monthClients = clients.filter((c) => inMonth.some((s) => s.clientId === c.id));
    const byMaterial = allMaterials.map((m) => ({ m, total: inMonth.reduce((a, s) => (s.materialId === m.id ? a + s.quantity : a), 0) }));
    const monthPieces = byMaterial.filter((x) => !x.m.noSupply).reduce((a, x) => a + x.total, 0);

    return (
      <>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium capitalize">
            {dayLong(date)}
            {isToday && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary normal-case">Hoy</span>}
          </p>
          <div className="flex items-center gap-1">
            <Link href={`/ordenes/insumos?fecha=${addDaysStr(date, -1)}`} className="btn-secondary h-8 px-2" aria-label="Día anterior">
              <ChevronLeft className="size-4" />
            </Link>
            <DateJump value={date} href="/ordenes/insumos?fecha={v}" />
            <Link href={`/ordenes/insumos?fecha=${addDaysStr(date, 1)}`} className="btn-secondary h-8 px-2" aria-label="Día siguiente">
              <ChevronRight className="size-4" />
            </Link>
            {!isToday && (
              <Link href="/ordenes/insumos" className="btn-secondary h-8 text-xs">
                Hoy
              </Link>
            )}
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <Stat label="Empaques usados" value={formatNumber(piecesDay)} icon={Boxes} hint={`${formatNumber(noSupplyDay)} paquete(s) sin insumo`} />
          <Stat label="Costo de insumos" value={formatMoney(dayMoney.cost)} icon={CircleDollarSign} hint={moneyHint(dayMoney)} />
          <Stat label="Órdenes del día" value={formatNumber(ordersDay)} icon={Package} href={`/ordenes?fecha=${date}`} hint="Capturadas por oleada" />
          <Stat
            label="Cuadre"
            value={active.length ? `${matched} de ${active.length}` : "—"}
            icon={matched === active.length ? CircleCheck : TriangleAlert}
            hint={active.length ? (matched === active.length ? "Todos los clientes cuadran" : "Clientes con piezas = órdenes") : "Sin movimientos en el día"}
          />
        </div>

        <Panel
          className="mb-6"
          title="Captura de insumos"
          description="Piezas de cada material por cliente. La última columna compara contra las órdenes del día."
          bodyClassName="p-0"
        >
          {materials.length === 0 ? (
            <Empty icon={Boxes}>Agrega al menos un material (abajo) para empezar a capturar.</Empty>
          ) : clients.length === 0 ? (
            <Empty icon={Boxes}>No hay clientes activos.</Empty>
          ) : (
            <OrderSheet
              key={date}
              kind="supplies"
              date={date}
              waves={materials.map((m) => ({ id: m.id, name: m.name, detail: sizeLabel(m.size) || undefined }))}
              clients={sheetClients}
              initial={initial}
            />
          )}
        </Panel>

        <div className="mb-6 grid gap-6 lg:grid-cols-5">
          <Panel className="lg:col-span-2" title="Consumo del mes por material" description={<span className="capitalize">{monthName(date)}</span>} bodyClassName="p-5">
            <BarList
              format="count"
              color="var(--chart-1)"
              total={monthPieces || undefined}
              emptyText="Sin insumos registrados en el mes."
              rows={byMaterial
                .filter((x) => x.total > 0 && !x.m.noSupply)
                .sort((a, b) => b.total - a.total)
                .map((x) => ({ key: String(x.m.id), label: x.m.name, value: x.total, hint: sizeLabel(x.m.size).split(" / ")[0] }))}
            />
            {byMaterial.some((x) => x.m.noSupply && x.total > 0) && (
              <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
                Sin insumo en el mes: <span className="font-medium text-foreground tabular-nums">{formatNumber(byMaterial.filter((x) => x.m.noSupply).reduce((a, x) => a + x.total, 0))}</span> paquetes
              </p>
            )}
          </Panel>

          <Panel className="lg:col-span-3" title="Consumo del mes por cliente" description="Da clic en un cliente para ver su detalle día por día." bodyClassName="p-0">
            {monthClients.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">Sin insumos registrados en el mes.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table min-w-[860px]">
                  <thead>
                    <tr className="text-xs text-muted-foreground [&>th]:px-2.5 [&>th]:py-2.5 [&>th]:font-medium">
                      <th className="pl-5 text-left">Cliente</th>
                      {allMaterials.map((m) => (
                        <th key={m.id} className="text-right leading-tight">
                          {m.name}
                        </th>
                      ))}
                      <th className="text-right">Total</th>
                      <th className="text-right">Costo</th>
                      <th className="text-right">Venta</th>
                      <th className="pr-5 text-right">Margen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthClients.map((c) => (
                      <tr key={c.id} className="border-t transition-colors hover:bg-muted/40 [&>td]:px-2.5 [&>td]:py-2">
                        <td className="pl-5 font-medium">
                          <Link href={`/ordenes/insumos?vista=cliente&cliente=${c.id}&mes=${monthKey}&fecha=${date}`} className="hover:text-primary hover:underline">
                            {c.name}
                          </Link>
                        </td>
                        {allMaterials.map((m) => {
                          const v = cell(c.id, m.id);
                          return (
                            <td key={m.id} className={cn("text-right tabular-nums", !v && "text-muted-foreground/40")}>
                              {formatNumber(v)}
                            </td>
                          );
                        })}
                        <td className="text-right font-semibold tabular-nums">{formatNumber(allMaterials.reduce((a, m) => a + cell(c.id, m.id), 0))}</td>
                        <MoneyCells x={money(inMonth.filter((s) => s.clientId === c.id))} />
                      </tr>
                    ))}
                    <tr className="border-t bg-muted font-semibold [&>td]:px-2.5 [&>td]:py-2.5">
                      <td className="pl-5">Total</td>
                      {byMaterial.map((x) => (
                        <td key={x.m.id} className="text-right tabular-nums">
                          {formatNumber(x.total)}
                        </td>
                      ))}
                      <td className="text-right tabular-nums">{formatNumber(byMaterial.reduce((a, x) => a + x.total, 0))}</td>
                      <MoneyCells x={money(inMonth)} />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <MaterialsPanel />
      </>
    );
  }

  // ───────────────────────────── Por cliente ─────────────────────────────
  function ClientView() {
    const withData = clients.filter((c) => supplies.some((s) => s.clientId === c.id && s.workDate >= month.from) || orders.some((o) => o.clientId === c.id && o.workDate >= month.from));
    const clientId = Number(q.cliente) || withData[0]?.id || clients[0]?.id;
    const client = clients.find((c) => c.id === clientId);
    if (!client) return <Empty icon={Boxes}>No hay clientes registrados.</Empty>;

    const mine = supplies.filter((s) => s.clientId === client.id && s.workDate >= month.from && s.workDate <= month.to);
    const myOrders = orders.filter((o) => o.clientId === client.id && o.workDate >= month.from && o.workDate <= month.to);
    const cols = allMaterials;
    const days = daysBetween(month.from, month.to)
      .map((d) => {
        const by = Object.fromEntries(cols.map((m) => [m.id, mine.reduce((a, s) => (s.workDate === d && s.materialId === m.id ? a + s.quantity : a), 0)])) as Record<number, number>;
        const total = Object.values(by).reduce((a, b) => a + b, 0);
        const ord = myOrders.reduce((a, o) => (o.workDate === d ? a + o.quantity : a), 0);
        return { d, by, total, ord };
      })
      .filter((x) => x.total || x.ord);
    const colTotal = (m: number) => days.reduce((a, x) => a + (x.by[m] ?? 0), 0);
    const mineMoney = money(mine);
    const grand = days.reduce((a, x) => a + x.total, 0);
    const ordTotal = days.reduce((a, x) => a + x.ord, 0);
    const pieces = cols.filter((m) => !m.noSupply).reduce((a, m) => a + colTotal(m.id), 0);
    const top = cols.filter((m) => !m.noSupply).sort((a, b) => colTotal(b.id) - colTotal(a.id))[0];
    const prevMonth = monthStartOf(addDaysStr(month.from, -1)).slice(0, 7);
    const nextMonth = addDaysStr(month.to, 1).slice(0, 7);
    const base = (mes: string, cliente = client.id) => `/ordenes/insumos?vista=cliente&cliente=${cliente}&mes=${mes}&fecha=${date}`;

    return (
      <>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <NavSelect
            label="Cliente"
            value={String(client.id)}
            href={`/ordenes/insumos?vista=cliente&mes=${monthKey}&fecha=${date}&cliente={v}`}
            options={clients.map((c) => ({ value: String(c.id), label: c.name }))}
          />
          <div className="flex items-center gap-1">
            <Link href={base(prevMonth)} className="btn-secondary h-8 px-2" aria-label="Mes anterior">
              <ChevronLeft className="size-4" />
            </Link>
            <DateJump type="month" value={monthKey} href={`/ordenes/insumos?vista=cliente&cliente=${client.id}&fecha=${date}&mes={v}`} />
            <Link href={base(nextMonth)} className="btn-secondary h-8 px-2" aria-label="Mes siguiente">
              <ChevronRight className="size-4" />
            </Link>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <Stat
            label="Empaques del mes"
            value={formatNumber(pieces)}
            icon={Boxes}
            hint={`${formatNumber(days.length ? Math.round((grand / days.length) * 10) / 10 : 0)} por día · ${formatNumber(grand - pieces)} sin insumo`}
          />
          <Stat label="Costo del mes" value={formatMoney(mineMoney.cost)} icon={CircleDollarSign} hint={moneyHint(mineMoney)} />
          <Stat label="Material más usado" value={top && colTotal(top.id) ? top.name : "—"} icon={Boxes} hint={top && colTotal(top.id) ? `${formatNumber(colTotal(top.id))} piezas` : undefined} />
          <Stat
            label="Cuadre del mes"
            value={grand === ordTotal ? "Cuadra" : `${grand - ordTotal > 0 ? "+" : ""}${formatNumber(grand - ordTotal)}`}
            icon={grand === ordTotal ? CircleCheck : TriangleAlert}
            hint={`${formatNumber(grand)} registradas vs. ${formatNumber(ordTotal)} órdenes`}
          />
        </div>

        <Panel title={client.name} description={<span className="capitalize">{monthName(month.from)} · da clic en un día para corregirlo</span>} bodyClassName="p-0">
          {days.length === 0 ? (
            <Empty icon={Boxes}>Sin insumos ni órdenes registrados en el mes.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="table min-w-[880px]">
                <thead>
                  <tr className="text-xs text-muted-foreground [&>th]:px-2.5 [&>th]:py-2.5 [&>th]:align-bottom [&>th]:font-medium">
                    <th className="pl-5 text-left capitalize">{monthName(month.from)}</th>
                    {cols.map((m) => (
                      <th key={m.id} className="max-w-32 text-right">
                        <span className="block leading-tight">{m.name}</span>
                        {m.size && <span className="mt-0.5 block text-[10.5px] leading-tight font-normal text-balance text-muted-foreground/80">{sizeLabel(m.size)}</span>}
                      </th>
                    ))}
                    <th className="border-l text-right">Total</th>
                    <th className="pr-5 text-right">Órdenes</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((x, i) => (
                    <tr key={x.d} className="viz-fade-in border-t transition-colors hover:bg-muted/40 [&>td]:px-2.5 [&>td]:py-2" style={{ "--viz-delay": `${Math.min(i * 12, 160)}ms` } as React.CSSProperties}>
                      <td className="pl-5 font-medium">
                        <Link href={`/ordenes/insumos?fecha=${x.d}`} className="capitalize hover:text-primary hover:underline">
                          {dayShort(x.d)}
                        </Link>
                      </td>
                      {cols.map((m) => (
                        <td key={m.id} className={cn("text-right tabular-nums", !x.by[m.id] && "text-muted-foreground/40")}>
                          {formatNumber(x.by[m.id] ?? 0)}
                        </td>
                      ))}
                      <td className="border-l text-right font-semibold tabular-nums">{formatNumber(x.total)}</td>
                      <td className="pr-5 text-right tabular-nums">
                        <span className="inline-flex items-center gap-2">
                          {formatNumber(x.ord)}
                          {x.total === x.ord ? (
                            <CircleCheck aria-label="Cuadra" className="size-3.5 text-emerald-600" />
                          ) : (
                            <span className="rounded-full bg-amber-50 px-1.5 text-[11px] font-medium text-amber-800" title="Piezas registradas menos órdenes">
                              {x.total - x.ord > 0 ? "+" : ""}
                              {formatNumber(x.total - x.ord)}
                            </span>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t bg-muted font-semibold [&>td]:px-2.5 [&>td]:py-2.5">
                    <td className="pl-5">Totales</td>
                    {cols.map((m) => (
                      <td key={m.id} className="text-right tabular-nums">
                        {formatNumber(colTotal(m.id))}
                      </td>
                    ))}
                    <td className="border-l text-right text-base tabular-nums">{formatNumber(grand)}</td>
                    <td className="pr-5 text-right tabular-nums">{formatNumber(ordTotal)}</td>
                  </tr>
                  {(
                    [
                      ["Costo", (m: (typeof cols)[number]) => supplyCost(colTotal(m.id), m), mineMoney.cost],
                      ["Venta", (m: (typeof cols)[number]) => supplySale(colTotal(m.id), m), mineMoney.sale],
                    ] as const
                  ).map(([label, f, total]) => (
                    <tr key={label} className="border-t text-xs text-muted-foreground [&>td]:px-2.5 [&>td]:py-2">
                      <td className="pl-5 font-medium">{label}</td>
                      {cols.map((m) => (
                        <td key={m.id} className="text-right tabular-nums">
                          {f(m) ? formatMoney(f(m)) : "—"}
                        </td>
                      ))}
                      <td className="border-l text-right font-semibold text-foreground tabular-nums">{formatMoney(total)}</td>
                      <td className="pr-5 text-right">{label === "Venta" && mineMoney.sale ? `Margen ${formatMoney(mineMoney.sale - mineMoney.cost)}` : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </>
    );
  }

  // ───────────────────────────── Catálogo ─────────────────────────────
  function MaterialsPanel() {
    return (
      <Panel
        title="Materiales"
        description="Son las columnas de la captura. Costo = lo que nos cuesta cada pieza; precio = lo que se cobra al cliente (sin IVA). Con precio 0 va incluido en el servicio. Ocultar un material no borra lo registrado."
        bodyClassName="p-5"
      >
        <ul className="divide-y rounded-lg border">
          {materials.map((m, i) => (
            <li key={m.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <Form action={updateMaterial.bind(null, m.id)} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <input name="name" defaultValue={m.name} aria-label="Nombre del material" className="input h-8 w-44" required />
                <input name="size" defaultValue={m.size} aria-label="Medidas" placeholder="Medidas (ej. 17*30)" className="input h-8 min-w-40 flex-1" />
                {m.noSupply ? (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">No es consumo</span>
                ) : (
                  <>
                    <MoneyInput name="unitCost" label="Costo" value={m.unitCost} />
                    <MoneyInput name="unitPrice" label="Precio" value={m.unitPrice} />
                    <span className="w-20 text-xs text-muted-foreground tabular-nums" title="Margen por pieza">
                      {m.unitPrice ? `${formatMoney(m.unitPrice - m.unitCost)} c/u` : "Incluido"}
                    </span>
                  </>
                )}
                <SubmitButton className="btn-secondary h-8 text-xs">Guardar</SubmitButton>
              </Form>
              <div className="flex items-center gap-1">
                <Form action={moveMaterial.bind(null, m.id)}>
                  <input type="hidden" name="dir" value="-1" />
                  <button className="btn-secondary h-8 px-2" aria-label="Mover a la izquierda" disabled={i === 0}>
                    <ArrowUp className="size-3.5" />
                  </button>
                </Form>
                <Form action={moveMaterial.bind(null, m.id)}>
                  <input type="hidden" name="dir" value="1" />
                  <button className="btn-secondary h-8 px-2" aria-label="Mover a la derecha" disabled={i === materials.length - 1}>
                    <ArrowDown className="size-3.5" />
                  </button>
                </Form>
                <Form action={toggleMaterial.bind(null, m.id)}>
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
          <Form action={addMaterial} resetOnSuccess className="flex w-full max-w-3xl flex-wrap items-center gap-2">
            <input name="name" placeholder="Nuevo material (ej. Caja G)" aria-label="Nuevo material" className="input h-9 w-48" required />
            <input name="size" placeholder="Medidas" aria-label="Medidas del nuevo material" className="input h-9 w-36" />
            <MoneyInput name="unitCost" label="Costo" value={0} />
            <MoneyInput name="unitPrice" label="Precio" value={0} />
            <SubmitButton className="btn-primary">
              <Plus className="size-4" />
              Agregar
            </SubmitButton>
          </Form>
          {hidden.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Ocultos:</span>
              {hidden.map((m) => (
                <Form key={m.id} action={toggleMaterial.bind(null, m.id)}>
                  <button className="btn-secondary h-7 px-2 text-xs" title="Mostrar de nuevo">
                    <Eye className="size-3.5" />
                    {m.name}
                  </button>
                </Form>
              ))}
            </div>
          )}
        </div>
      </Panel>
    );
  }
}

function MoneyCells({ x }: { x: { cost: number; sale: number } }) {
  const pct = marginPct(x.sale, x.cost);
  return (
    <>
      <td className="text-right text-muted-foreground tabular-nums">{formatMoney(x.cost)}</td>
      <td className="text-right tabular-nums">{x.sale ? formatMoney(x.sale) : "—"}</td>
      <td className={cn("pr-5 text-right tabular-nums", pct !== null && pct < 0 && "text-rose-700")}>{pct === null ? "—" : `${pct}%`}</td>
    </>
  );
}

function MoneyInput({ name, label, value }: { name: string; label: string; value: number }) {
  return (
    <label className="relative">
      <span className="sr-only">{label} por pieza</span>
      <span aria-hidden className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-[11px] text-muted-foreground">
        {label} $
      </span>
      <input name={name} type="number" step="0.01" min="0" defaultValue={value || ""} placeholder="0.00" className="input h-8 w-32 pl-14 text-right tabular-nums" />
    </label>
  );
}
