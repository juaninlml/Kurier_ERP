import Link from "next/link";
import { CalendarRange, ChevronLeft, ChevronRight, CircleCheck, FileCheck2, PackageOpen, TriangleAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/current-user";
import { canWrite } from "@/lib/permissions";
import { addDaysStr } from "@/lib/attendance";
import { DATE_RE, companyToday, rangeLabel, weekOf } from "@/lib/orders";
import { lastWeek, weeklyBoard, type WeeklyRow } from "@/lib/weekly-billing";
import { formatMoney, formatNumber } from "@/lib/money";
import { PageHeader, Panel, Stat, Empty, StatusBadge } from "@/components/kit";
import { WeeklyEmitButton } from "@/components/WeeklyEmitButton";
import { localeOf } from "@/lib/i18n";
import { getLang, getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await getT())("Facturación semanal") };
}

export default async function WeeklyBillingPage({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  const [{ semana }, me, t, lang, today] = await Promise.all([searchParams, getCurrentUser(), getT(), getLang(), companyToday()]);
  const current = weekOf(today).from;
  const from = semana && DATE_RE.test(semana) ? weekOf(semana).from : lastWeek(today);
  const { week, rows, totals } = await weeklyBoard(from);
  const canEdit = canWrite(me.role, "facturas");
  const locale = localeOf(lang);
  const ready = rows.filter((r) => r.ready);
  const inProgress = from >= current;
  const prev = addDaysStr(from, -7);
  const next = addDaysStr(from, 7);

  const issueText = (r: WeeklyRow) =>
    r.issues
      .map((i) => (i === "noRate" ? t("Sin tarifa por paquete") : t("{v0} insumo(s) sin precio", { v0: r.unpriced })))
      .join(" · ");

  return (
    <div>
      <PageHeader
        title={t("Facturación semanal")}
        subtitle={t("Las facturas de servicio logístico de cada cliente, armadas solas con sus órdenes diarias e insumos de empaque de la semana. Revísalas y emítelas.")}
        back={{ href: "/facturas", label: "Facturas" }}
        actions={
          canEdit && (
            <WeeklyEmitButton
              week={from}
              clientIds={ready.map((r) => r.client.id)}
              total={formatMoney(totals.readyTotal)}
              label={t("Emitir {n} factura(s) listas", { n: ready.length })}
              confirmText={t("¿Emitir {n} factura(s) de la semana {v0}?", { n: ready.length, v0: rangeLabel(week.from, week.to, locale) })}
            />
          )
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Link href={`/facturas/semanal?semana=${prev}`} className="btn-secondary h-9 px-2.5" aria-label={t("Semana anterior")}>
          <ChevronLeft className="size-4" />
        </Link>
        <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-sm font-medium">
          <CalendarRange className="size-4 text-muted-foreground" /> {rangeLabel(week.from, week.to, locale)}
        </div>
        <Link href={`/facturas/semanal?semana=${next}`} aria-disabled={next > current} className={cn("btn-secondary h-9 px-2.5", next > current && "pointer-events-none opacity-45")} aria-label={t("Semana siguiente")}>
          <ChevronRight className="size-4" />
        </Link>
        {from !== lastWeek(today) && (
          <Link href="/facturas/semanal" className="text-sm text-primary underline-offset-2 hover:underline">
            {t("Ir a la última semana completa")}
          </Link>
        )}
      </div>

      {inProgress && (
        <p className="mb-6 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <TriangleAlert className="size-4 shrink-0" /> {t("Esta semana sigue en curso: las órdenes pueden cambiar. Lo normal es facturarla a partir del lunes siguiente.")}
        </p>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label={t("Por facturar")} value={String(totals.pending)} hint={t("clientes con órdenes sin factura")} icon={PackageOpen} />
        <Stat label={t("Listas para emitir")} value={String(totals.ready)} hint={formatMoney(totals.readyTotal)} icon={CircleCheck} />
        <Stat label={t("Ya facturadas")} value={String(totals.invoiced)} icon={FileCheck2} />
      </div>

      <Panel title={t("Clientes de la semana")} description={t("Servicio logístico (paquetes × tarifa) más el material de empaque usado. Los importes incluyen IVA.")}>
        {rows.length === 0 ? (
          <Empty icon={PackageOpen}>{t("No hay órdenes capturadas en esta semana.")}</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="px-5 py-2 font-medium">{t("Cliente")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("Paquetes")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("Tarifa")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("Empaque")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("Total")}</th>
                  <th className="px-3 py-2 font-medium">{t("Estado")}</th>
                  <th className="px-5 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.client.id} className={cn("border-b last:border-0", r.invoice && "text-muted-foreground")}>
                    <td className="px-5 py-2.5 font-medium text-foreground">{r.client.name}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(r.packages)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.rate.rate ? formatMoney(r.rate.rate) : "—"}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.supplySale ? formatMoney(r.supplySale) : "—"}</td>
                    <td className="px-3 py-2.5 text-right font-semibold whitespace-nowrap text-foreground tabular-nums">{formatMoney(r.invoice ? r.invoice.total : r.total)}</td>
                    <td className="px-3 py-2.5">
                      {r.invoice ? (
                        <Link href={`/facturas/${r.invoice.id}`} className="inline-flex items-center gap-1.5 hover:underline">
                          {r.invoice.folio} <StatusBadge status={r.invoice.status} />
                        </Link>
                      ) : r.ready ? (
                        <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">{t("Lista")}</span>
                      ) : (
                        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">{issueText(r)}</span>
                      )}
                    </td>
                    <td className="px-5 py-2 text-right whitespace-nowrap">
                      {!r.invoice && canEdit && (
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/facturas/nueva?ordenes=${r.client.id}&semana=${from}`} className={r.ready ? "btn-secondary h-8 px-2.5 text-xs" : "btn-primary h-8 px-2.5 text-xs"}>
                            {t("Revisar")}
                          </Link>
                          {r.ready && (
                            <WeeklyEmitButton
                              small
                              week={from}
                              clientIds={[r.client.id]}
                              total={formatMoney(r.total)}
                              label={t("Emitir")}
                              confirmText={t("¿Emitir la factura de {v0}?", { v0: r.client.name })}
                            />
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <p className="mt-4 text-xs text-muted-foreground">
        {t("Al emitir se usa la fecha de hoy, el plazo de pago y las notas de Configuración, la marca del cliente y su serie de folios si tiene una. Los clientes sin tarifa por paquete o con insumos sin precio se revisan uno por uno.")}
      </p>
    </div>
  );
}
