import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, EyeOff, Link2, Plus, RotateCcw, Trash2, Wand2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { createFromLine, deleteStatement, matchLine, runAutoMatch, toggleIgnoreLine, unmatchLine } from "@/app/actions/bank";
import { PageHeader, Stat } from "@/components/kit";
import { Form } from "@/components/Form";
import { SubmitButton } from "@/components/SubmitButton";
import { ConfirmButton } from "@/components/ConfirmButton";
import { suggestMatches } from "@/lib/bank-csv";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/constants";
import { formatDate, formatMoney, round2 } from "@/lib/money";
import { getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const VIEWS = ["pendientes", "conciliados", "ignorados", "todos"] as const;
type View = (typeof VIEWS)[number];
const DAY = 86_400_000;

export default async function StatementPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ver?: string }> }) {
  const t = await getT();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const sp = await searchParams;
  const view: View = (VIEWS as readonly string[]).includes(sp.ver ?? "") ? (sp.ver as View) : "pendientes";
  const imp = await prisma.bankImport.findUnique({
    where: { id },
    include: {
      lines: {
        orderBy: [{ date: "asc" }, { id: "asc" }],
        include: { transaction: { select: { id: true, date: true, description: true, category: true, type: true } } },
      },
    },
  });
  if (!imp) notFound();

  const pending = imp.lines.filter((l) => !l.transactionId && !l.ignored);
  const done = imp.lines.filter((l) => l.transactionId);
  const ignored = imp.lines.filter((l) => l.ignored);
  const deposits = round2(imp.lines.filter((l) => l.amount > 0).reduce((a, l) => a + l.amount, 0));
  const withdrawals = round2(imp.lines.filter((l) => l.amount < 0).reduce((a, l) => a - l.amount, 0));

  // Sugerencias para lo pendiente: movimientos sin conciliar con el mismo importe y fecha cercana
  let suggestions = new Map<number, { id: number; date: Date; amount: number; type: string; description: string; category: string }>();
  if (pending.length) {
    const min = new Date(Math.min(...pending.map((l) => l.date.getTime())) - 6 * DAY);
    const max = new Date(Math.max(...pending.map((l) => l.date.getTime())) + 6 * DAY);
    const txs = await prisma.transaction.findMany({
      where: { date: { gte: min, lte: max }, bankLine: null },
      select: { id: true, date: true, amount: true, type: true, description: true, category: true },
    });
    suggestions = suggestMatches(pending, txs);
  }
  const needsForm = pending.some((l) => !suggestions.has(l.id));
  const [clients, suppliers] = needsForm
    ? await Promise.all([
        prisma.client.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
        prisma.supplier.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      ])
    : [[], []];

  const shown = view === "pendientes" ? pending : view === "conciliados" ? done : view === "ignorados" ? ignored : imp.lines;
  const counts: Record<View, number> = { pendientes: pending.length, conciliados: done.length, ignorados: ignored.length, todos: imp.lines.length };
  const viewLabel: Record<View, string> = { pendientes: "Pendientes", conciliados: "Conciliados", ignorados: "Ignorados", todos: "Todos" };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={imp.name}
        subtitle={`${imp.fileName}${imp.fromDate && imp.toDate ? ` · ${formatDate(imp.fromDate)} – ${formatDate(imp.toDate)}` : ""}`}
        back={{ href: "/contabilidad/conciliacion", label: t("Conciliación bancaria") }}
        actions={
          <>
            {pending.length > 0 && (
              <Form action={runAutoMatch.bind(null, imp.id)}>
                <SubmitButton className="btn-secondary" pendingText={t("Buscando…")}>
                  <Wand2 className="size-4" /> {t("Conciliar automáticamente")}
                </SubmitButton>
              </Form>
            )}
            <Form action={deleteStatement.bind(null, imp.id)}>
              <ConfirmButton message={t("¿Eliminar este estado de cuenta? Los movimientos de contabilidad no se borran; solo se quita la conciliación.")} className="btn-danger">
                <Trash2 className="size-4" /> {t("Eliminar")}
              </ConfirmButton>
            </Form>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Depósitos" value={formatMoney(deposits)} tone="pos" />
        <Stat label="Retiros" value={formatMoney(withdrawals)} tone="neg" />
        <Stat label="Conciliados" value={`${done.length} / ${imp.lines.length - ignored.length}`} hint={ignored.length ? t("{n} ignorado(s)", { n: ignored.length }) : undefined} />
        <Stat label="Pendientes" value={String(pending.length)} hint={pending.length ? t("{n} con sugerencia", { n: pending.filter((l) => suggestions.has(l.id)).length }) : t("Todo conciliado")} />
      </div>

      <div className="card overflow-hidden">
        <nav className="flex gap-1 overflow-x-auto border-b px-4 py-3" aria-label={t("Filtrar renglones")}>
          {VIEWS.map((v) => (
            <Link
              key={v}
              href={`/contabilidad/conciliacion/${imp.id}${v === "pendientes" ? "" : `?ver=${v}`}`}
              aria-current={view === v ? "page" : undefined}
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm transition-colors",
                view === v ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {t(viewLabel[v])}
              <span className="rounded-md bg-muted px-1.5 text-[11px] text-muted-foreground tabular-nums">{counts[v]}</span>
            </Link>
          ))}
        </nav>
        {shown.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            {view === "pendientes" ? t("Todo conciliado. Cada renglón del banco tiene su movimiento.") : t("Sin renglones en esta vista.")}
          </p>
        ) : (
          <ul className="divide-y">
            {shown.map((l) => {
              const sug = suggestions.get(l.id);
              const type = l.amount > 0 ? "INGRESO" : "EGRESO";
              return (
                <li key={l.id} className={cn("grid gap-3 px-4 py-3 md:grid-cols-[6.5rem_minmax(0,1fr)_8rem_minmax(0,22rem)] md:items-center", l.ignored && "opacity-60")}>
                  <div className="text-sm text-muted-foreground tabular-nums">{formatDate(l.date)}</div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium" title={l.description}>
                      {l.description || t("(sin descripción)")}
                    </div>
                    {l.reference && <div className="truncate text-xs text-muted-foreground">{l.reference}</div>}
                  </div>
                  <div className={cn("text-right font-medium tabular-nums", l.amount > 0 ? "text-emerald-700" : "text-rose-700")}>
                    {l.amount > 0 ? "+" : "−"}
                    {formatMoney(Math.abs(l.amount))}
                  </div>
                  <div className="text-sm">
                    {l.transaction ? (
                      <div className="flex items-center justify-between gap-2">
                        <Link href={`/contabilidad/movimientos/${l.transaction.id}`} className="flex min-w-0 items-center gap-1.5 text-emerald-700 hover:underline">
                          <Check className="size-4 shrink-0" />
                          <span className="truncate">{l.transaction.description || t(l.transaction.category)}</span>
                        </Link>
                        <Form action={unmatchLine.bind(null, l.id)}>
                          <SubmitButton className="btn h-8 px-2 text-xs text-muted-foreground hover:bg-muted" pendingText="…">
                            <RotateCcw className="size-3.5" /> {t("Deshacer")}
                          </SubmitButton>
                        </Form>
                      </div>
                    ) : l.ignored ? (
                      <Form action={toggleIgnoreLine.bind(null, l.id)}>
                        <SubmitButton className="btn h-8 px-2 text-xs text-muted-foreground hover:bg-muted" pendingText="…">
                          <RotateCcw className="size-3.5" /> {t("Restaurar")}
                        </SubmitButton>
                      </Form>
                    ) : (
                      <div className="space-y-2">
                        {sug && (
                          <Form action={matchLine.bind(null, l.id, sug.id)} className="flex items-center justify-between gap-2 rounded-lg bg-sky-50 px-2.5 py-1.5">
                            <span className="min-w-0 text-xs text-sky-900">
                              <span className="block truncate font-medium">{sug.description || t(sug.category)}</span>
                              <span className="text-sky-800/80">{formatDate(sug.date)}</span>
                            </span>
                            <SubmitButton className="btn h-7 shrink-0 bg-sky-600 px-2.5 text-xs text-white hover:bg-sky-700" pendingText="…">
                              <Link2 className="size-3.5" /> {t("Conciliar")}
                            </SubmitButton>
                          </Form>
                        )}
                        <div className="flex flex-wrap items-center gap-2">
                          <details className="group w-full">
                            <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-md text-xs font-medium text-primary hover:underline">
                              <Plus className="size-3.5" /> {t("Registrar como movimiento nuevo")}
                            </summary>
                            <Form action={createFromLine.bind(null, l.id)} className="mt-2 grid gap-2 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2">
                              <select name="category" required defaultValue="" className="input h-8 text-xs sm:col-span-2">
                                <option value="" disabled>
                                  {t("Categoría…")}
                                </option>
                                {(type === "INGRESO" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => (
                                  <option key={c} value={c}>
                                    {t(c)}
                                  </option>
                                ))}
                              </select>
                              {type === "INGRESO" ? (
                                <select name="clientId" defaultValue="" className="input h-8 text-xs">
                                  <option value="">{t("Sin cliente")}</option>
                                  {clients.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.name}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <select name="supplierId" defaultValue="" className="input h-8 text-xs">
                                  <option value="">{t("Sin proveedor")}</option>
                                  {suppliers.map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {s.name}
                                    </option>
                                  ))}
                                </select>
                              )}
                              <input name="tax" type="number" step="0.01" min="0" defaultValue={0} aria-label={t("IVA incluido")} placeholder={t("IVA incluido")} className="input h-8 text-right text-xs tabular-nums" />
                              <input name="description" defaultValue={l.description} maxLength={200} aria-label={t("Concepto")} className="input h-8 text-xs sm:col-span-2" />
                              <SubmitButton className="btn-primary h-8 text-xs sm:col-span-2" pendingText={t("Registrando…")}>
                                {t("Registrar y conciliar")}
                              </SubmitButton>
                            </Form>
                          </details>
                          <Form action={toggleIgnoreLine.bind(null, l.id)}>
                            <SubmitButton className="btn h-7 px-2 text-xs text-muted-foreground hover:bg-muted" pendingText="…">
                              <EyeOff className="size-3.5" /> {t("Ignorar")}
                            </SubmitButton>
                          </Form>
                        </div>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
