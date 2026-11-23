"use client";

import { useRef } from "react";
import { HandCoins, X } from "lucide-react";
import { Form } from "./Form";
import { SubmitButton } from "./SubmitButton";
import { useT } from "./I18nProvider";
import { formatMoney } from "@/lib/money";
import { PAYMENT_METHODS } from "@/lib/constants";

import { NumberField } from "./NumberField";
/** Botón de lista para registrar un pago sin entrar al documento (facturas y cuentas por pagar; abre un cuadro de diálogo). */
export function InvoicePayButton({
  action,
  folio,
  client,
  balance,
  today,
  note,
}: {
  action: (fd: FormData) => Promise<unknown>;
  folio: string;
  client: string;
  balance: number;
  today: string;
  /** Aviso bajo el formulario (por omisión: se registra como ingreso). Ya traducido. */
  note?: string;
}) {
  const t = useT();
  const dialog = useRef<HTMLDialogElement>(null);
  const close = () => dialog.current?.close();

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        aria-label={t("Registrar pago de {v0}", { v0: folio })}
        title={t("Registrar pago")}
        className="inline-grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
      >
        <HandCoins className="size-4" />
      </button>
      <dialog
        ref={dialog}
        onClick={(e) => e.target === dialog.current && close()}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl bg-card p-0 text-left text-card-foreground shadow-2xl backdrop:bg-black/50"
      >
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 className="font-semibold">{t("Registrar pago")}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {folio} · {client} · {t("Saldo")} <span className="font-medium text-foreground tabular-nums">{formatMoney(balance)}</span>
            </p>
          </div>
          <button type="button" onClick={close} aria-label={t("Cerrar")} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>
        <Form
          action={async (fd) => {
            // Al registrarse sin error, se cierra el cuadro (la lista se actualiza sola)
            const r = await action(fd);
            if (!(r && typeof r === "object" && "error" in r)) close();
            return r;
          }}
          className="space-y-3 px-5 py-4"
        >
          <label className="block">
            <span className="label">{t("Monto")}</span>
            <NumberField name="amount" defaultValue={balance} required className="input text-right tabular-nums" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="label">{t("Fecha")}</span>
              <input name="date" type="date" defaultValue={today} required className="input" />
            </label>
            <label className="block">
              <span className="label">{t("Método")}</span>
              <select name="method" className="input">
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {t(m)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="label">{t("Referencia")}</span>
            <input name="reference" className="input" placeholder={t("SPEI, # de cheque…")} />
          </label>
          <p className="text-xs text-muted-foreground">{note ?? t("Se registra automáticamente como ingreso en contabilidad.")}</p>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={close} className="btn-secondary">
              {t("Cancelar")}
            </button>
            <SubmitButton className="btn-kurier" pendingText={t("Registrando…")}>
              <HandCoins className="size-4" /> {t("Registrar pago")}
            </SubmitButton>
          </div>
        </Form>
      </dialog>
    </>
  );
}
