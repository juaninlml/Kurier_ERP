import Link from "next/link";
import { Boxes, PackagePlus, ClipboardCheck, TriangleAlert, Trash2, Warehouse, CircleDollarSign } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { canWrite } from "@/lib/permissions";
import { companyToday } from "@/lib/orders";
import { inventory, type InventoryRow } from "@/lib/inventory";
import { formatMoney, formatNumber } from "@/lib/money";
import { addStockCount, addStockEntry, deleteStockMove, setMinStock } from "@/app/actions/inventory";
import { PageHeader, Panel, Stat, Empty } from "@/components/kit";
import { OrdersTabs } from "@/components/OrdersTabs";
import { Form } from "@/components/Form";
import { SubmitButton } from "@/components/SubmitButton";
import { ConfirmButton } from "@/components/ConfirmButton";
import { NumberField } from "@/components/NumberField";
import { StockAlert } from "@/components/StockAlert";
import { localeOf } from "@/lib/i18n";
import { getLang, getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await getT())("Inventario de insumos") };
}

const sizeLabel = (size: string) => size.replace(/\s*\/\s*/g, " / ").replace(/\*/g, "×");

const STATUS: Record<InventoryRow["status"], { label: string; className: string }> = {
  out: { label: "Agotado", className: "bg-destructive/10 text-destructive" },
  low: { label: "Por agotarse", className: "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200" },
  ok: { label: "Suficiente", className: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" },
  untracked: { label: "Sin conteo", className: "bg-muted text-muted-foreground" },
};

export default async function InventoryPage() {
  const [me, t, lang, today] = await Promise.all([getCurrentUser(), getT(), getLang(), companyToday()]);
  const [{ rows, alerts, totals }, moves, suppliers] = await Promise.all([
    inventory(today),
    prisma.stockMove.findMany({ orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 40, include: { material: { select: { name: true } } } }),
    prisma.supplier.findMany({ where: { active: true }, select: { name: true }, orderBy: { name: "asc" } }),
  ]);
  const canEdit = canWrite(me.role, "ordenes");
  const locale = localeOf(lang);
  const date = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const options = rows.filter((r) => r.active);

  return (
    <div>
      <PageHeader title={t("Inventario de insumos")} subtitle={t("Existencias de bolsas, cajas y demás insumos de empaque, con alerta cuando se están acabando.")} />
      <OrdersTabs active="inventario" date={today} />

      <StockAlert alerts={alerts.map((a) => ({ id: a.id, name: a.name, stock: a.stock ?? 0, minStock: a.minStock, days: a.days, status: a.status as "out" | "low" }))} className="mb-6" />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label={t("Insumos con inventario")} value={`${totals.tracked} / ${rows.filter((r) => r.active).length}`} hint={t("Los demás necesitan un conteo inicial")} icon={Warehouse} />
        <Stat
          label={t("Por agotarse")}
          value={String(totals.low + totals.out)}
          tone={totals.low + totals.out ? "neg" : undefined}
          hint={totals.out ? t("{n} agotado(s)", { n: totals.out }) : t("Todo con existencia")}
          icon={TriangleAlert}
        />
        <Stat label={t("Valor del inventario")} value={formatMoney(totals.value)} hint={t("A costo por pieza, sin IVA")} icon={CircleDollarSign} />
      </div>

      <Panel title={t("Existencias")} description={t("Existencia = último conteo físico + entradas − piezas capturadas en Insumos de empaque.")} className="mb-6">
        {rows.length === 0 ? (
          <Empty icon={Boxes}>{t("Agrega materiales en Insumos de empaque para llevar su inventario.")}</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="px-5 py-2 font-medium">{t("Material")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("Existencia")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("Consumo / día")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("Alcanza para")}</th>
                  <th className="px-3 py-2 font-medium">{t("Estado")}</th>
                  <th className="px-5 py-2 font-medium">{t("Mínimo (alerta)")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={cn("border-b last:border-0", !r.active && "opacity-55")}>
                    <td className="px-5 py-2.5">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {[r.size && sizeLabel(r.size), r.lastCount && t("contado el {v0}", { v0: date(r.lastCount) }), !r.active && t("oculto en la captura")].filter(Boolean).join(" · ")}
                      </div>
                    </td>
                    <td className={cn("px-3 py-2.5 text-right font-semibold tabular-nums", r.stock !== null && r.stock <= 0 && "text-destructive")}>
                      {r.stock === null ? "—" : formatNumber(r.stock)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.perDay > 0 ? formatNumber(Math.round(r.perDay * 10) / 10) : "—"}</td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">{r.days === null ? "—" : t("{n} días", { n: r.days })}</td>
                    <td className="px-3 py-2.5">
                      <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap", STATUS[r.status].className)}>{t(STATUS[r.status].label)}</span>
                    </td>
                    <td className="px-5 py-2">
                      {canEdit ? (
                        <Form action={setMinStock.bind(null, r.id)} className="flex items-center gap-1.5">
                          <NumberField name="minStock" defaultValue={r.minStock || undefined} className="input h-8 w-24 text-right tabular-nums" placeholder="0" aria-label={t("Mínimo de {v0}", { v0: r.name })} />
                          <SubmitButton className="btn-secondary h-8 px-2.5 text-xs" pendingText="…">
                            {t("Guardar")}
                          </SubmitButton>
                        </Form>
                      ) : (
                        <span className="tabular-nums">{r.minStock ? formatNumber(r.minStock) : "—"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {canEdit && options.length > 0 && (
        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <Panel title={t("Registrar entrada")} description={t("Material que llegó del proveedor. Suma a la existencia.")} bodyClassName="p-5">
            <Form action={addStockEntry} resetOnSuccess successMessage={t("Entrada registrada.")} className="grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="label">{t("Material")}</span>
                <select name="materialId" required className="input">
                  {options.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                      {m.size ? ` (${sizeLabel(m.size)})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="label">{t("Piezas recibidas")}</span>
                <NumberField name="quantity" required className="input text-right tabular-nums" />
              </label>
              <label className="block">
                <span className="label">{t("Fecha")}</span>
                <input name="date" type="date" defaultValue={today} max={today} required className="input" />
              </label>
              <label className="block">
                <span className="label">{t("Costo por pieza (sin IVA, opcional)")}</span>
                <NumberField name="unitCost" className="input text-right tabular-nums" placeholder="$0.00" />
              </label>
              <label className="block">
                <span className="label">{t("Proveedor (opcional)")}</span>
                <input name="supplier" list="inventory-suppliers" maxLength={120} className="input" />
                <datalist id="inventory-suppliers">
                  {suppliers.map((s) => (
                    <option key={s.name} value={s.name} />
                  ))}
                </datalist>
              </label>
              <label className="block sm:col-span-2">
                <span className="label">{t("Nota (opcional)")}</span>
                <input name="note" maxLength={500} className="input" placeholder={t("Ej. factura del proveedor A-1234")} />
              </label>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" name="updateCost" defaultChecked className="size-4" />
                {t("Usar este costo como el nuevo costo por pieza del material")}
              </label>
              <div className="flex justify-end sm:col-span-2">
                <SubmitButton pendingText={t("Guardando…")}>
                  <PackagePlus className="size-4" /> {t("Registrar entrada")}
                </SubmitButton>
              </div>
            </Form>
          </Panel>

          <Panel title={t("Conteo físico")} description={t("Cuenta lo que hay en el almacén al cierre del día. Corrige la existencia y es el punto de partida del inventario.")} bodyClassName="p-5">
            <Form action={addStockCount} resetOnSuccess successMessage={t("Conteo registrado.")} className="grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="label">{t("Material")}</span>
                <select name="materialId" required className="input">
                  {options.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                      {m.size ? ` (${sizeLabel(m.size)})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="label">{t("Piezas contadas")}</span>
                <NumberField name="quantity" required className="input text-right tabular-nums" />
              </label>
              <label className="block">
                <span className="label">{t("Fecha del conteo")}</span>
                <input name="date" type="date" defaultValue={today} max={today} required className="input" />
              </label>
              <label className="block sm:col-span-2">
                <span className="label">{t("Nota (opcional)")}</span>
                <input name="note" maxLength={500} className="input" />
              </label>
              <p className="text-xs text-muted-foreground sm:col-span-2">{t("Captura antes las piezas usadas de ese día en Insumos de empaque: el conteo es la existencia al cierre.")}</p>
              <div className="flex justify-end sm:col-span-2">
                <SubmitButton pendingText={t("Guardando…")}>
                  <ClipboardCheck className="size-4" /> {t("Registrar conteo")}
                </SubmitButton>
              </div>
            </Form>
          </Panel>
        </div>
      )}

      <Panel title={t("Movimientos recientes")} description={t("Las últimas 40 entradas y conteos.")}>
        {moves.length === 0 ? (
          <Empty icon={ClipboardCheck}>{t("Aún no hay movimientos. Empieza con un conteo físico de cada material.")}</Empty>
        ) : (
          <ul className="divide-y">
            {moves.map((x) => (
              <li key={x.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                <span className={cn("shrink-0 rounded-md px-2 py-0.5 text-xs font-medium", x.kind === "ENTRADA" ? "bg-primary/10 text-primary" : "bg-muted")}>
                  {t(x.kind === "ENTRADA" ? "Entrada" : "Conteo")}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{x.material.name}</span>{" "}
                  <span className="tabular-nums">{x.kind === "ENTRADA" ? `+${formatNumber(x.quantity)}` : `= ${formatNumber(x.quantity)}`}</span>
                  {x.unitCost > 0 && <span className="text-muted-foreground"> · {formatMoney(x.unitCost)} c/u</span>}
                  <div className="truncate text-xs text-muted-foreground">
                    {[date(x.date), x.supplier, x.note, x.createdBy].filter(Boolean).join(" · ")}
                  </div>
                </div>
                {canEdit && (
                  <Form action={deleteStockMove.bind(null, x.id)}>
                    <ConfirmButton message={t("¿Borrar este movimiento? La existencia se recalcula.")} className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="size-3.5" aria-hidden />
                      <span className="sr-only">{t("Borrar movimiento")}</span>
                    </ConfirmButton>
                  </Form>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <p className="mt-4 text-xs text-muted-foreground">
        {t("El consumo diario es el promedio de las últimas 4 semanas (lunes a sábado). Los materiales “Sin insumo” no llevan inventario.")}{" "}
        <Link href="/ordenes/insumos" className="underline underline-offset-2">
          {t("Ir a Insumos de empaque")}
        </Link>
      </p>
    </div>
  );
}
