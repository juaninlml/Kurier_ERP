"use client";

import { useState, useTransition } from "react";
import { Banknote, Check, CircleAlert, Landmark, Loader2 } from "lucide-react";
import { setPayrollLineMethod, setPayrollLinePaid } from "@/app/actions/payroll";
import { CopyButton } from "./CopyButton";
import { useT } from "./I18nProvider";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export type PaymentRow = {
  id: number;
  name: string;
  area: string;
  position: string;
  bank: string;
  clabe: string;
  net: number;
  method: "TRANSFERENCIA" | "EFECTIVO";
  comments: string;
  paidAt: string | null;
  paidBy: string;
};

/**
 * Pagos de una nómina aprobada: solo el neto de cada empleado, con su banco y CLABE.
 * Quien hace los pagos marca a cada empleado; cuando todos están pagados la nómina pasa a pagada.
 */
export function PayrollPayments({ rows, total, status }: { rows: PaymentRow[]; total: number; status: string }) {
  const t = useT();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const [, start] = useTransition();

  const payable = rows.filter((r) => r.net > 0);
  const paid = payable.filter((r) => r.paidAt);
  const byTransfer = payable.filter((r) => r.method === "TRANSFERENCIA").reduce((a, r) => a + r.net, 0);
  const byCash = payable.filter((r) => r.method === "EFECTIVO").reduce((a, r) => a + r.net, 0);
  const pendingAmount = payable.filter((r) => !r.paidAt).reduce((a, r) => a + r.net, 0);

  const run = (id: number, fn: () => Promise<{ error: string } | void>) => {
    setError("");
    setBusy(id);
    start(async () => {
      const r = await fn();
      if (r && "error" in r) setError(t(r.error));
      setBusy(null);
    });
  };

  const stats: [string, string, string?][] = [
    [t("Total de la nómina"), formatMoney(total)],
    [t("Por transferencia"), formatMoney(byTransfer)],
    [t("En efectivo"), formatMoney(byCash)],
    [t("Pagados"), `${paid.length} / ${payable.length}`, paid.length === payable.length ? "text-emerald-700 dark:text-emerald-400" : undefined],
    [t("Falta por pagar"), formatMoney(pendingAmount), pendingAmount > 0 ? "text-kurier" : "text-emerald-700 dark:text-emerald-400"],
  ];

  return (
    <section className="card overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3.5">
        <div>
          <h2 className="text-[0.95rem] font-semibold">{t("Pagos a empleados")}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {status === "PAGADA"
              ? t("Todos los empleados están pagados. La nómina quedó registrada como egreso en contabilidad.")
              : t("Marca a cada empleado cuando se le pague. Al quedar todos pagados, la nómina pasa a «Pagada» y se registra el egreso.")}
          </p>
        </div>
      </header>

      <div className="grid gap-px border-b bg-border sm:grid-cols-3 xl:grid-cols-5">
        {stats.map(([k, v, cls]) => (
          <div key={k} className="bg-card px-5 py-3">
            <div className="text-xs text-muted-foreground">{k}</div>
            <div className={cn("text-lg font-semibold tabular-nums", cls)}>{v}</div>
          </div>
        ))}
      </div>

      {error && (
        <p role="alert" className="flex items-center gap-2 border-b bg-rose-50 px-5 py-2 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
          <CircleAlert className="size-4 shrink-0" /> {error}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th className="w-10 text-right">#</th>
              <th>{t("Empleado")}</th>
              <th>{t("Banco")}</th>
              <th>{t("Cuenta / CLABE")}</th>
              <th className="text-right">{t("Importe a pagar")}</th>
              <th>{t("Método")}</th>
              <th>{t("Comentarios")}</th>
              <th className="text-center">{t("¿Pagado?")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const done = !!r.paidAt;
              return (
                <tr key={r.id} className={cn(done && "bg-emerald-50/60 dark:bg-emerald-950/20")}>
                  <td className="text-right text-muted-foreground tabular-nums">{i + 1}</td>
                  <td>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-[11px] text-muted-foreground">{[r.position, r.area].filter(Boolean).join(" · ") || "—"}</div>
                  </td>
                  <td className="whitespace-nowrap">{r.bank || "—"}</td>
                  <td>
                    {r.clabe ? (
                      <span className="inline-flex items-center gap-1 font-mono text-xs whitespace-nowrap">
                        {r.clabe.replace(/(\d{4})(?=\d)/g, "$1 ")}
                        <CopyButton value={r.clabe.replace(/\s/g, "")} label={t("Copiar CLABE")} />
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">{t("Sin CLABE")}</span>
                    )}
                  </td>
                  <td className="text-right font-semibold whitespace-nowrap tabular-nums">{formatMoney(r.net)}</td>
                  <td>
                    <select
                      aria-label={t("Método de pago de {v0}", { v0: r.name })}
                      className="input h-8 w-36 text-sm"
                      value={r.method}
                      disabled={done || busy === r.id || r.net <= 0}
                      onChange={(e) => run(r.id, () => setPayrollLineMethod(r.id, e.target.value))}
                    >
                      <option value="TRANSFERENCIA">{t("Transferencia")}</option>
                      <option value="EFECTIVO">{t("Efectivo")}</option>
                    </select>
                  </td>
                  <td className="max-w-64 text-xs text-muted-foreground">{r.comments || "—"}</td>
                  <td className="text-center">
                    {r.net <= 0 ? (
                      <span className="text-xs text-muted-foreground">{t("Sin pago")}</span>
                    ) : (
                      <button
                        type="button"
                        aria-pressed={done}
                        disabled={busy === r.id}
                        onClick={() => run(r.id, () => setPayrollLinePaid(r.id, !done))}
                        title={done ? t("Pagado por {v0}. Clic para desmarcar.", { v0: r.paidBy }) : t("Marcar como pagado")}
                        className={cn(
                          "inline-flex h-8 min-w-24 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors",
                          done
                            ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
                            : "border-input bg-background text-foreground hover:border-emerald-600 hover:text-emerald-700",
                        )}
                      >
                        {busy === r.id ? <Loader2 className="size-3.5 animate-spin" /> : done ? <Check className="size-3.5" /> : r.method === "EFECTIVO" ? <Banknote className="size-3.5" /> : <Landmark className="size-3.5" />}
                        {done ? t("Pagado") : t("Marcar")}
                      </button>
                    )}
                    {done && (
                      <div className="mt-0.5 text-[10px] whitespace-nowrap text-muted-foreground">
                        {r.paidBy} · {new Date(r.paidAt!).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
