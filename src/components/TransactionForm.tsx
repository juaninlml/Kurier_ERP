"use client";

import { useState } from "react";
import Link from "next/link";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS } from "@/lib/constants";
import { SubmitButton } from "./SubmitButton";
import { Form } from "./Form";
import { Tr } from "@/components/Tr";
import { useT } from "@/components/I18nProvider";

import { NumberField, parseNumber } from "./NumberField";
type Tx = {
  type: string;
  category: string;
  amount: number;
  tax: number;
  date: string;
  description: string;
  method: string;
  reference: string;
  clientId: number | null;
  supplierId: number | null;
};

export function TransactionForm({
  action,
  clients,
  suppliers,
  tx,
  defaultTaxRate,
  submitLabel,
}: {
  action: (fd: FormData) => Promise<unknown>;
  clients: { id: number; name: string }[];
  /** Proveedores activos; su giro se propone como categoría del egreso. */
  suppliers: { id: number; name: string; category: string }[];
  tx: Tx;
  defaultTaxRate: number;
  submitLabel: string;
}) {
  const tr = useT();
  const t = useT();
  const [type, setType] = useState(tx.type);
  const [category, setCategory] = useState(tx.category);
  const [amount, setAmount] = useState(String(tx.amount || ""));
  const [tax, setTax] = useState(String(tx.tax || ""));
  const categories = type === "INGRESO" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const calcTax = () => {
    const a = parseNumber(amount);
    setTax(((a * defaultTaxRate) / (100 + defaultTaxRate)).toFixed(2));
  };

  return (
    <Form action={action} className="space-y-3">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        {(["INGRESO", "EGRESO"] as const).map((t) => (
          <label
            key={t}
            className={`cursor-pointer rounded-md py-1.5 text-center text-sm font-medium ${
              type === t ? (t === "INGRESO" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white") : "text-muted-foreground"
            }`}
          >
            <input type="radio" name="type" value={t} checked={type === t} onChange={() => setType(t)} className="sr-only" />
            {t === "INGRESO" ? tr("Ingreso") : tr("Egreso")}
          </label>
        ))}
      </div>
      <label className="block">
        <span className="label"><Tr>Categoría</Tr></span>
        <select
          name="category"
          value={(categories as readonly string[]).includes(category) ? category : ""}
          onChange={(e) => setCategory(e.target.value)}
          required
          className="input"
        >
          <option value="" disabled>
            {t("Selecciona…")}
          </option>
          {categories.map((c) => (
            <option key={c} value={c}>{tr(c)}</option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label"><Tr>Monto total (con IVA)</Tr></span>
          <NumberField name="amount" required value={amount} onValueChange={(_, x) => setAmount(x)} className="input text-right tabular-nums" />
        </label>
        <label className="block">
          <span className="label flex justify-between">
            <Tr>IVA incluido</Tr>
            <button type="button" onClick={calcTax} className="normal-case text-primary hover:underline">
              <Tr>calcular</Tr> {defaultTaxRate}%
            </button>
          </span>
          <NumberField name="tax" value={tax} onValueChange={(_, x) => setTax(x)} className="input text-right tabular-nums" />
        </label>
      </div>
      <label className="block">
        <span className="label"><Tr>Fecha</Tr></span>
        <input name="date" type="date" defaultValue={tx.date} required className="input" />
      </label>
      <label className="block">
        <span className="label"><Tr>Concepto</Tr></span>
        <input name="description" defaultValue={tx.description} className="input" placeholder={t("Ej. Renta de bodega noviembre")} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label"><Tr>Método</Tr></span>
          <select name="method" defaultValue={tx.method} className="input">
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>{tr(m)}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label"><Tr>Referencia</Tr></span>
          <input name="reference" defaultValue={tx.reference} className="input text-right tabular-nums" />
        </label>
      </div>
      {/* Ingreso: quién pagó (cliente). Egreso: a quién se le pagó (proveedor). */}
      {type === "INGRESO" ? (
        <label className="block">
          <span className="label">
            <Tr>Cliente</Tr>
          </span>
          <select name="clientId" defaultValue={tx.clientId ?? ""} className="input">
            <option value="">{t("Sin cliente")}</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className="block">
          <span className="label flex justify-between">
            <Tr>Proveedor</Tr>
            <Link href="/proveedores/nuevo" className="normal-case text-primary hover:underline">
              <Tr>nuevo</Tr>
            </Link>
          </span>
          <select
            name="supplierId"
            defaultValue={tx.supplierId ?? ""}
            onChange={(e) => {
              const s = suppliers.find((x) => String(x.id) === e.target.value);
              if (s?.category && (EXPENSE_CATEGORIES as readonly string[]).includes(s.category)) setCategory(s.category);
            }}
            className="input"
          >
            <option value="">{t("Sin proveedor")}</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <SubmitButton className="btn-primary w-full">{submitLabel}</SubmitButton>
    </Form>
  );
}
