"use client";

import { useState } from "react";
import Link from "next/link";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { Form } from "./Form";
import { SubmitButton } from "./SubmitButton";
import { useT } from "./I18nProvider";

export type BillSupplier = { id: number; name: string; category: string; creditDays: number };
export type BillValues = {
  supplierId: number | null;
  folio: string;
  concept: string;
  category: string;
  issueDate: string;
  dueDate: string;
  total: number;
  tax: number;
  notes: string;
};

const addDaysIso = (iso: string, days: number) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/**
 * Alta y edición de una cuenta por pagar. Al elegir proveedor se propone su giro como categoría y el
 * vencimiento se calcula con sus días de crédito (mientras no se haya cambiado a mano).
 */
export function BillForm({
  action,
  suppliers,
  bill,
  defaultTaxRate,
  submitLabel,
  lockSupplier,
  editing,
}: {
  action: (fd: FormData) => Promise<unknown>;
  suppliers: BillSupplier[];
  bill: BillValues;
  defaultTaxRate: number;
  submitLabel: string;
  /** Con pagos registrados el proveedor ya no se cambia. */
  lockSupplier?: boolean;
  /** Edición: muestra el aviso de "Cambios guardados" (el alta redirige al detalle). */
  editing?: boolean;
}) {
  const t = useT();
  const [supplierId, setSupplierId] = useState(bill.supplierId ? String(bill.supplierId) : "");
  const [category, setCategory] = useState(bill.category);
  const [issueDate, setIssueDate] = useState(bill.issueDate);
  const [dueDate, setDueDate] = useState(bill.dueDate);
  const [dueTouched, setDueTouched] = useState(!!bill.supplierId && bill.dueDate !== bill.issueDate);
  const [total, setTotal] = useState(bill.total ? String(bill.total) : "");
  const [tax, setTax] = useState(bill.tax ? String(bill.tax) : "");
  const supplier = suppliers.find((s) => String(s.id) === supplierId);

  const pickSupplier = (id: string) => {
    setSupplierId(id);
    const s = suppliers.find((x) => String(x.id) === id);
    if (!s) return;
    if (s.category && (EXPENSE_CATEGORIES as readonly string[]).includes(s.category)) setCategory(s.category);
    if (!dueTouched) setDueDate(addDaysIso(issueDate, s.creditDays));
  };
  const pickIssue = (v: string) => {
    setIssueDate(v);
    if (!dueTouched) setDueDate(addDaysIso(v, supplier?.creditDays ?? 0));
  };
  const calcTax = () => {
    const a = Number(total) || 0;
    setTax(((a * defaultTaxRate) / (100 + defaultTaxRate)).toFixed(2));
  };

  return (
    <Form action={action} successMessage={editing ? "Cambios guardados." : undefined} className="card space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block sm:col-span-2">
          <span className="label flex justify-between">
            {t("Proveedor *")}
            {!lockSupplier && (
              <Link href="/proveedores/nuevo" className="normal-case text-primary hover:underline">
                {t("nuevo")}
              </Link>
            )}
          </span>
          <select name="supplierId" value={supplierId} onChange={(e) => pickSupplier(e.target.value)} required disabled={lockSupplier} className="input">
            <option value="" disabled>
              {t("Selecciona…")}
            </option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {/* Un select deshabilitado no se envía */}
          {lockSupplier && <input type="hidden" name="supplierId" value={supplierId} />}
        </label>
        <label className="block">
          <span className="label">{t("Folio del proveedor")}</span>
          <input name="folio" defaultValue={bill.folio} maxLength={60} className="input" placeholder={t("Ej. A-1234")} />
        </label>
        <label className="block">
          <span className="label">{t("Categoría *")}</span>
          <select name="category" value={category} onChange={(e) => setCategory(e.target.value)} required className="input">
            <option value="" disabled>
              {t("Selecciona…")}
            </option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(c)}
              </option>
            ))}
          </select>
        </label>
        <label className="block sm:col-span-2 lg:col-span-4">
          <span className="label">{t("Concepto *")}</span>
          <input name="concept" defaultValue={bill.concept} required maxLength={200} className="input" placeholder={t("Ej. Renta de bodega noviembre")} />
        </label>
        <label className="block">
          <span className="label">{t("Fecha de la factura *")}</span>
          <input name="issueDate" type="date" value={issueDate} onChange={(e) => pickIssue(e.target.value)} required className="input" />
        </label>
        <label className="block">
          <span className="label">{t("Vence *")}</span>
          <input
            name="dueDate"
            type="date"
            value={dueDate}
            min={issueDate}
            onChange={(e) => {
              setDueDate(e.target.value);
              setDueTouched(true);
            }}
            required
            className="input"
          />
          <span className="mt-1 block text-xs text-muted-foreground">
            {supplier ? (supplier.creditDays ? t("Crédito a {n} días", { n: supplier.creditDays }) : t("Pago de contado")) : " "}
          </span>
        </label>
        <label className="block">
          <span className="label">{t("Total (con IVA) *")}</span>
          <input name="total" type="number" step="0.01" min="0.01" required value={total} onChange={(e) => setTotal(e.target.value)} className="input text-right tabular-nums" />
        </label>
        <label className="block">
          <span className="label flex justify-between">
            {t("IVA incluido")}
            <button type="button" onClick={calcTax} className="normal-case text-primary hover:underline">
              {t("calcular")} {defaultTaxRate}%
            </button>
          </span>
          <input name="tax" type="number" step="0.01" min="0" value={tax} onChange={(e) => setTax(e.target.value)} className="input text-right tabular-nums" />
        </label>
        <label className="block sm:col-span-2 lg:col-span-4">
          <span className="label">{t("Notas internas")}</span>
          <textarea name="notes" rows={2} defaultValue={bill.notes} className="input" />
        </label>
      </div>
      <div className="flex justify-end">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </Form>
  );
}
