"use client";

import { useState } from "react";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS } from "@/lib/constants";
import { SubmitButton } from "./SubmitButton";
import { Form } from "./Form";
import { Tr } from "@/components/Tr";
import { useT } from "@/components/I18nProvider";

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
};

export function TransactionForm({
  action,
  clients,
  tx,
  defaultTaxRate,
  submitLabel,
}: {
  action: (fd: FormData) => Promise<unknown>;
  clients: { id: number; name: string }[];
  tx: Tx;
  defaultTaxRate: number;
  submitLabel: string;
}) {
  const tr = useT();
  const t = useT();
  const [type, setType] = useState(tx.type);
  const [amount, setAmount] = useState(String(tx.amount || ""));
  const [tax, setTax] = useState(String(tx.tax || ""));
  const categories = type === "INGRESO" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const calcTax = () => {
    const a = Number(amount) || 0;
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
        <select name="category" key={type} defaultValue={(categories as readonly string[]).includes(tx.category) ? tx.category : ""} required className="input">
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
          <input name="amount" type="number" step="0.01" min="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="label flex justify-between">
            <Tr>IVA incluido</Tr>
            <button type="button" onClick={calcTax} className="normal-case text-primary hover:underline">
              <Tr>calcular</Tr> {defaultTaxRate}%
            </button>
          </span>
          <input name="tax" type="number" step="0.01" min="0" value={tax} onChange={(e) => setTax(e.target.value)} className="input" />
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
          <input name="reference" defaultValue={tx.reference} className="input" />
        </label>
      </div>
      <label className="block">
        <span className="label"><Tr>Cliente (opcional)</Tr></span>
        <select name="clientId" defaultValue={tx.clientId ?? ""} className="input">
          <option value="">—</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <SubmitButton className="btn-primary w-full">{submitLabel}</SubmitButton>
    </Form>
  );
}
