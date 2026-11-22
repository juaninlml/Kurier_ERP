import Link from "next/link";
import { Landmark, Upload } from "lucide-react";
import { prisma } from "@/lib/db";
import { importStatement } from "@/app/actions/bank";
import { PageHeader, Panel, Empty, Stat, Field } from "@/components/kit";
import { Form } from "@/components/Form";
import { SubmitButton } from "@/components/SubmitButton";
import { addDays, formatDate, formatMoney, round2 } from "@/lib/money";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await getT())("Conciliación bancaria") };
}

export default async function ReconciliationPage() {
  const t = await getT();
  const since = addDays(new Date(), -90);
  const [imports, stats, pendingTx] = await Promise.all([
    prisma.bankImport.findMany({ orderBy: { id: "desc" }, take: 50 }),
    prisma.bankLine.groupBy({
      by: ["importId"],
      _count: { _all: true, transactionId: true },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({ where: { date: { gte: since }, bankLine: null }, _count: { _all: true }, _sum: { amount: true } }),
  ]);
  const ignored = await prisma.bankLine.groupBy({ by: ["importId"], where: { ignored: true }, _count: { _all: true } });
  const byImport = new Map(stats.map((s) => [s.importId, s]));
  const ignoredBy = new Map(ignored.map((s) => [s.importId, s._count._all]));
  const totalPending = imports.reduce((a, i) => {
    const s = byImport.get(i.id);
    return a + (s ? s._count._all - s._count.transactionId - (ignoredBy.get(i.id) ?? 0) : 0);
  }, 0);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Conciliación bancaria"
        subtitle={t("Sube el estado de cuenta del banco y cruza cada depósito y retiro con los movimientos de contabilidad.")}
        back={{ href: "/contabilidad", label: t("Contabilidad") }}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Stat label="Renglones del banco por conciliar" value={String(totalPending)} hint={t("En los estados de cuenta subidos")} icon={Landmark} />
        <Stat
          label="Movimientos sin conciliar (90 días)"
          value={String(pendingTx._count._all)}
          hint={t("Registrados en contabilidad sin su renglón del banco")}
          href="/contabilidad"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Panel title={t("Estados de cuenta")}>
          {imports.length === 0 ? (
            <Empty icon={Landmark}>{t("Aún no has subido estados de cuenta. Descarga el CSV de tu banca en línea y súbelo aquí.")}</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t("Cuenta")}</th>
                    <th>{t("Periodo")}</th>
                    <th className="text-right">{t("Renglones")}</th>
                    <th className="text-right">{t("Conciliados")}</th>
                    <th className="text-right">{t("Pendientes")}</th>
                    <th className="text-right">{t("Neto")}</th>
                  </tr>
                </thead>
                <tbody>
                  {imports.map((i) => {
                    const s = byImport.get(i.id);
                    const total = s?._count._all ?? 0;
                    const done = s?._count.transactionId ?? 0;
                    const pend = total - done - (ignoredBy.get(i.id) ?? 0);
                    return (
                      <tr key={i.id}>
                        <td>
                          <Link href={`/contabilidad/conciliacion/${i.id}`} className="font-medium text-primary hover:underline">
                            {i.name}
                          </Link>
                          <div className="text-xs text-muted-foreground">
                            {i.fileName} · {formatDate(i.createdAt)}
                          </div>
                        </td>
                        <td className="whitespace-nowrap text-muted-foreground">
                          {i.fromDate && i.toDate ? `${formatDate(i.fromDate)} – ${formatDate(i.toDate)}` : "—"}
                        </td>
                        <td className="text-right tabular-nums">{total}</td>
                        <td className="text-right tabular-nums text-emerald-700">{done}</td>
                        <td className={`text-right font-medium tabular-nums ${pend > 0 ? "text-amber-700" : "text-muted-foreground"}`}>{pend}</td>
                        <td className="text-right tabular-nums">{formatMoney(round2(s?._sum.amount ?? 0))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title={t("Subir estado de cuenta")} description={t("Archivo CSV de la banca en línea (máx. 2 MB)")}>
          <Form action={importStatement} className="space-y-3 p-5">
            <Field label="Cuenta">
              <input name="name" required maxLength={80} className="input" placeholder={t("Ej. BBVA 1234")} />
            </Field>
            <Field label="Archivo CSV">
              <input name="file" type="file" accept=".csv,.txt,text/csv" required className="input" />
            </Field>
            <SubmitButton className="btn-primary w-full" pendingText={t("Leyendo…")}>
              <Upload className="size-4" /> {t("Subir y conciliar")}
            </SubmitButton>
            <p className="text-xs text-muted-foreground">
              {t("Se reconocen las columnas Fecha, Descripción o Concepto, Referencia y Cargo/Abono (o Monto). Al subirlo se ligan solos los renglones con el mismo importe y fecha cercana.")}
            </p>
          </Form>
        </Panel>
      </div>
    </div>
  );
}
