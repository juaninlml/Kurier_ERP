import Link from "next/link";
import { AlarmClock, CalendarCheck, CalendarClock, HandCoins, Wallet } from "lucide-react";
import { getCurrentUser } from "@/lib/current-user";
import { canWrite } from "@/lib/permissions";
import { PageHeader, Panel, Stat, Empty } from "@/components/kit";
import { CollectionActions, DeleteCollectionNote } from "@/components/CollectionActions";
import { InvoicePayButton } from "@/components/InvoicePayButton";
import { addPayment } from "@/app/actions/invoices";
import { collectionBoard, filterRows, mailtoUrl, reminderMessage, whatsappUrl, CONTACT_LABEL, isContactKind, type CollectionFilter } from "@/lib/collections";
import { companyToday } from "@/lib/orders";
import { formatMoney } from "@/lib/money";
import { formatCurrency } from "@/lib/currency";
import { localeOf } from "@/lib/i18n";
import { getLang, getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await getT())("Cobranza") };
}

const FILTERS: { id: CollectionFilter; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "vencidos", label: "Vencidos" },
  { id: "por-vencer", label: "Vencen en 7 días" },
  { id: "promesas", label: "Promesas de pago" },
];

export default async function CollectionsPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const [{ f }, me, t, lang, today] = await Promise.all([searchParams, getCurrentUser(), getT(), getLang(), companyToday()]);
  const filter: CollectionFilter = FILTERS.some((x) => x.id === f) ? (f as CollectionFilter) : "todos";
  const { rows, totals } = await collectionBoard(today);
  const shown = filterRows(rows, filter);
  const canEdit = canWrite(me.role, "cobranza");
  const canPay = canWrite(me.role, "facturas");
  const locale = localeOf(lang);
  const date = (d: Date | string) => new Date(typeof d === "string" ? `${d}T12:00:00Z` : d).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const when = (d: Date) => d.toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" });
  const messages = await Promise.all(shown.map((r) => reminderMessage(r)));
  const count = (id: CollectionFilter) => filterRows(rows, id).length;

  return (
    <div>
      <PageHeader title={t("Cobranza")} subtitle={t("Clientes con saldo, del más atrasado al más reciente. Manda el recordatorio, registra cada seguimiento y las promesas de pago.")} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("Por cobrar")} value={formatMoney(totals.balance)} hint={t("{n} cliente(s) con saldo", { n: totals.clients })} icon={Wallet} />
        <Stat
          label={t("Vencido")}
          value={formatMoney(totals.overdue)}
          tone={totals.overdue ? "neg" : undefined}
          hint={totals.overdueClients ? t("{n} cliente(s) atrasados", { n: totals.overdueClients }) : t("Nada vencido")}
          icon={AlarmClock}
          href={totals.overdueClients ? "/cobranza?f=vencidos" : undefined}
        />
        <Stat label={t("Vence en 7 días")} value={formatMoney(totals.dueSoon)} icon={CalendarClock} href={totals.dueSoon ? "/cobranza?f=por-vencer" : undefined} />
        <Stat
          label={t("Promesas de pago")}
          value={String(totals.promisesToday)}
          hint={totals.promisesBroken ? t("{n} incumplida(s)", { n: totals.promisesBroken }) : t("para hoy")}
          tone={totals.promisesBroken ? "neg" : undefined}
          icon={CalendarCheck}
          href="/cobranza?f=promesas"
        />
      </div>

      <nav className="mb-4 flex flex-wrap gap-2" aria-label={t("Filtrar")}>
        {FILTERS.map((x) => (
          <Link
            key={x.id}
            href={x.id === "todos" ? "/cobranza" : `/cobranza?f=${x.id}`}
            aria-current={filter === x.id ? "page" : undefined}
            className={cn("rounded-full border px-3 py-1 text-sm transition-colors", filter === x.id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}
          >
            {t(x.label)} <span className="tabular-nums opacity-70">{count(x.id)}</span>
          </Link>
        ))}
      </nav>

      {shown.length === 0 ? (
        <Panel>
          <Empty icon={HandCoins}>{rows.length ? t("Ningún cliente coincide con el filtro.") : t("No hay saldos pendientes. ¡Todo cobrado!")}</Empty>
        </Panel>
      ) : (
        <div className="space-y-4">
          {shown.map((r, idx) => {
            const msg = messages[idx];
            return (
              <Panel
                key={r.id}
                title={
                  <Link href={`/clientes/${r.id}`} className="hover:underline">
                    {r.name}
                  </Link>
                }
                description={[r.contactName, r.phone, r.email].filter(Boolean).join(" · ") || t("Sin datos de contacto")}
                action={
                  <div className="text-right">
                    <div className="text-lg font-semibold tabular-nums">{formatMoney(r.balance)}</div>
                    <div className={cn("text-xs", r.overdue ? "font-medium text-destructive" : "text-muted-foreground")}>
                      {r.overdue ? t("{v0} vencido · {n} días de atraso", { v0: formatMoney(r.overdue), n: r.maxDays }) : t("Al corriente")}
                    </div>
                  </div>
                }
                bodyClassName="space-y-4 px-5 py-4"
              >
                {r.promise && (
                  <p
                    className={cn(
                      "rounded-md px-3 py-2 text-sm",
                      r.promise.state === "broken" ? "bg-destructive/10 text-destructive" : r.promise.state === "today" ? "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200" : "bg-muted",
                    )}
                  >
                    {t(r.promise.state === "broken" ? "Promesa incumplida: iba a pagar el {v0}" : r.promise.state === "today" ? "Prometió pagar hoy ({v0})" : "Prometió pagar el {v0}", { v0: date(r.promise.date) })}
                    {r.promise.amount > 0 && ` · ${formatMoney(r.promise.amount)}`}
                  </p>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-muted-foreground">
                      <tr className="border-b">
                        <th className="py-1.5 pr-3 font-medium">{t("Folio")}</th>
                        <th className="py-1.5 pr-3 font-medium">{t("Vence")}</th>
                        <th className="py-1.5 pr-3 font-medium">{t("Atraso")}</th>
                        <th className="py-1.5 pr-3 text-right font-medium">{t("Saldo")}</th>
                        {canPay && <th className="w-10" aria-label={t("Registrar pago")} />}
                      </tr>
                    </thead>
                    <tbody>
                      {r.invoices.map((i) => (
                        <tr key={i.id} className="border-b last:border-0">
                          <td className="py-1.5 pr-3">
                            <Link href={`/facturas/${i.id}`} className="font-medium hover:underline">
                              {i.folio}
                            </Link>
                          </td>
                          <td className="py-1.5 pr-3 whitespace-nowrap">{date(i.dueDate)}</td>
                          <td className={cn("py-1.5 pr-3 whitespace-nowrap", i.overdue && "font-medium text-destructive")}>
                            {i.overdue ? t("{n} días", { n: i.daysOverdue }) : t("Al corriente")}
                          </td>
                          <td className="py-1.5 pr-3 text-right whitespace-nowrap tabular-nums">
                            {formatCurrency(i.balance, i.currency)}
                            {i.currency === "CNY" && <span className="ml-1 text-xs text-muted-foreground">CNY</span>}
                          </td>
                          {canPay && (
                            <td className="py-0.5 text-right">
                              <InvoicePayButton action={addPayment.bind(null, i.id)} folio={i.folio} client={r.name} balance={i.balance} currency={i.currency} today={today} />
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <CollectionActions
                  clientId={r.id}
                  waUrl={r.phone.length >= 10 ? whatsappUrl(r.phone, msg.text) : null}
                  mailUrl={r.email ? mailtoUrl(r.email, msg.subject, msg.text) : null}
                  pdfHref={`/api/pdf/estado-cuenta/${r.id}`}
                  canEdit={canEdit}
                  today={today}
                />

                {r.notes.length > 0 && (
                  <div>
                    <h3 className="mb-1.5 text-xs font-medium text-muted-foreground uppercase">{t("Seguimiento")}</h3>
                    <ul className="divide-y rounded-lg border">
                      {r.notes.map((n) => (
                        <li key={n.id} className="flex items-start gap-3 px-3 py-2 text-sm">
                          <span className="mt-0.5 shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-medium">{t(CONTACT_LABEL[isContactKind(n.kind) ? n.kind : "NOTA"])}</span>
                          <div className="min-w-0 flex-1">
                            {n.note && <p className="text-pretty">{t(n.note)}</p>}
                            {n.promiseDate && (
                              <p className="text-xs font-medium">
                                {t("Prometió pagar el {v0}", { v0: date(n.promiseDate) })}
                                {n.promiseAmount > 0 && ` · ${formatMoney(n.promiseAmount)}`}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {when(n.createdAt)}
                              {n.createdBy && ` · ${n.createdBy}`}
                            </p>
                          </div>
                          {canEdit && <DeleteCollectionNote id={n.id} />}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
