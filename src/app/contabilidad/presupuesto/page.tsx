import Link from "next/link";
import { ChevronLeft, ChevronRight, Copy } from "lucide-react";
import { saveBudget, copyPreviousBudget } from "@/app/actions/budget";
import { budgetRows, type BudgetRow } from "@/lib/budget";
import { PageHeader, Stat } from "@/components/kit";
import { Form } from "@/components/Form";
import { SubmitButton } from "@/components/SubmitButton";
import { ExportButton } from "@/components/ExportButton";
import { formatMoney, round2 } from "@/lib/money";
import { requestLocale } from "@/lib/request-lang";
import { getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await getT())("Presupuesto") };
}

const sum = (rows: BudgetRow[], k: keyof Pick<BudgetRow, "budget" | "actual" | "ytdBudget" | "ytdActual">) => round2(rows.reduce((a, r) => a + r[k], 0));

export default async function BudgetPage({ searchParams }: { searchParams: Promise<{ anio?: string; mes?: string }> }) {
  const t = await getT();
  const sp = await searchParams;
  const now = new Date();
  const year = Number(sp.anio) >= 2000 && Number(sp.anio) <= 2100 ? Number(sp.anio) : now.getFullYear();
  const month = Number(sp.mes) >= 1 && Number(sp.mes) <= 12 ? Number(sp.mes) : now.getMonth() + 1;
  const rows = await budgetRows(year, month);
  const income = rows.filter((r) => r.type === "INGRESO");
  const expense = rows.filter((r) => r.type === "EGRESO");
  const monthName = new Intl.DateTimeFormat(requestLocale(), { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 15)));
  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const hasBudget = rows.some((r) => r.budget > 0);
  const resultBudget = round2(sum(income, "budget") - sum(expense, "budget"));
  const resultActual = round2(sum(income, "actual") - sum(expense, "actual"));

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Presupuesto"
        subtitle={t("Lo planeado contra lo real de cada categoría, en el mes y en lo que va del año.")}
        back={{ href: "/contabilidad", label: t("Contabilidad") }}
        actions={<ExportButton kind="presupuesto" params={{ anio: year, mes: month }} />}
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Link href={`/contabilidad/presupuesto?anio=${prev.y}&mes=${prev.m}`} className="btn-secondary size-9 px-0" aria-label={t("Mes anterior")}>
            <ChevronLeft className="size-4" />
          </Link>
          <h2 className="min-w-44 text-center text-lg font-semibold capitalize">{monthName}</h2>
          <Link href={`/contabilidad/presupuesto?anio=${next.y}&mes=${next.m}`} className="btn-secondary size-9 px-0" aria-label={t("Mes siguiente")}>
            <ChevronRight className="size-4" />
          </Link>
        </div>
        <Form action={copyPreviousBudget.bind(null, year, month)}>
          <SubmitButton className="btn-secondary" pendingText={t("Copiando…")}>
            <Copy className="size-4" /> {t("Copiar del mes anterior")}
          </SubmitButton>
        </Form>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Ingresos" value={formatMoney(sum(income, "actual"))} hint={t("Presupuesto {v0}", { v0: formatMoney(sum(income, "budget")) })} tone="pos" />
        <Stat label="Egresos" value={formatMoney(sum(expense, "actual"))} hint={t("Presupuesto {v0}", { v0: formatMoney(sum(expense, "budget")) })} tone="neg" />
        <Stat
          label="Resultado"
          value={formatMoney(resultActual)}
          tone={resultActual >= 0 ? "pos" : "neg"}
          hint={t("Presupuestado {v0}", { v0: formatMoney(resultBudget) })}
        />
      </div>

      {!hasBudget && (
        <p className="mb-4 rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
          {t("Este mes aún no tiene presupuesto. Escribe el monto planeado de cada categoría y guarda; lo real se toma de los movimientos de contabilidad.")}
        </p>
      )}

      <Form action={saveBudget.bind(null, year, month)} successMessage="Presupuesto guardado." className="space-y-6">
        <BudgetTable title={t("Ingresos")} rows={income} good="over" t={t} />
        <BudgetTable title={t("Egresos")} rows={expense} good="under" t={t} />
        <div className="flex justify-end">
          <SubmitButton>{t("Guardar presupuesto")}</SubmitButton>
        </div>
      </Form>
    </div>
  );
}

/** Tabla de una sección. En ingresos lo bueno es pasar el presupuesto; en egresos, quedar abajo. */
function BudgetTable({ title, rows, good, t }: { title: string; rows: BudgetRow[]; good: "over" | "under"; t: (s: string, v?: Record<string, string | number>) => string }) {
  return (
    <section className="card overflow-hidden">
      <header className="flex items-center justify-between border-b px-5 py-3.5">
        <h3 className="text-[0.95rem] font-semibold">{title}</h3>
      </header>
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>{t("Categoría")}</th>
              <th className="w-40 text-right">{t("Presupuesto")}</th>
              <th className="text-right">{t("Real")}</th>
              <th className="text-right">{t("Diferencia")}</th>
              <th className="w-48">{t("Avance")}</th>
              <th className="text-right">{t("Año: presupuesto")}</th>
              <th className="text-right">{t("Año: real")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const diff = round2(r.actual - r.budget);
              const pct = r.budget > 0 ? r.actual / r.budget : null;
              const bad = r.budget > 0 && (good === "under" ? diff > 0 : diff < 0);
              return (
                <tr key={r.category}>
                  <td className="font-medium">{t(r.category)}</td>
                  <td className="py-1.5 text-right">
                    <input
                      name={`b:${r.type}|${r.category}`}
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={r.budget || ""}
                      placeholder="0.00"
                      aria-label={t("Presupuesto de {v0}", { v0: t(r.category) })}
                      className="input h-8 text-right tabular-nums"
                    />
                  </td>
                  <td className="text-right tabular-nums">{formatMoney(r.actual)}</td>
                  <td className={cn("text-right tabular-nums", r.budget > 0 ? (bad ? "font-medium text-rose-700" : "text-emerald-700") : "text-muted-foreground")}>
                    {r.budget > 0 ? `${diff > 0 ? "+" : diff < 0 ? "−" : ""}${formatMoney(Math.abs(diff))}` : "—"}
                  </td>
                  <td>
                    {pct === null ? (
                      <span className="text-xs text-muted-foreground">{r.actual > 0 ? t("Sin presupuesto") : "—"}</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${Math.round(pct * 100)}%`}>
                          <div className={cn("h-full rounded-full", bad ? "bg-rose-500" : "bg-emerald-500")} style={{ width: `${Math.min(100, pct * 100)}%` }} />
                        </div>
                        <span className={cn("w-11 text-right text-xs tabular-nums", bad ? "text-rose-700" : "text-muted-foreground")}>{Math.round(pct * 100)}%</span>
                      </div>
                    )}
                  </td>
                  <td className="text-right text-muted-foreground tabular-nums">{r.ytdBudget ? formatMoney(r.ytdBudget) : "—"}</td>
                  <td className="text-right text-muted-foreground tabular-nums">{r.ytdActual ? formatMoney(r.ytdActual) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t font-semibold">
              <td className="px-4 py-2.5">{t("Total")}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(sum(rows, "budget"))}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(sum(rows, "actual"))}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(round2(sum(rows, "actual") - sum(rows, "budget")))}</td>
              <td />
              <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(sum(rows, "ytdBudget"))}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(sum(rows, "ytdActual"))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
