"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Form } from "./Form";
import { SubmitButton } from "./SubmitButton";
import { NumberField } from "./NumberField";
import { useT } from "./I18nProvider";
import { exitPieces, exitTotals } from "@/lib/goods-exit";
import { formatNumber } from "@/lib/money";

type Row = { key: number; sku: string; boxes: number; piecesPerBox: number };
export type ExitFormValues = {
  clientId: number;
  date: string;
  time: string;
  reference: string;
  carrier: string;
  plates: string;
  driverName: string;
  deliveredBy: string;
  notes: string;
  items: { sku: string; boxes: number; piecesPerBox: number }[];
};

let seq = 0;
const blank = (): Row => ({ key: ++seq, sku: "", boxes: 0, piecesPerBox: 0 });

/**
 * Alta y edición de una salida de mercancía: datos del embarque y renglones SKU · cajas · piezas por caja.
 * `skuHints` = SKUs que ya salieron por cliente (con sus piezas por caja más recientes) para autocompletar.
 */
export function ExitForm({
  action,
  clients,
  skuHints,
  exit,
  today,
}: {
  action: (fd: FormData) => Promise<unknown>;
  clients: { id: number; name: string }[];
  skuHints: Record<number, { sku: string; piecesPerBox: number }[]>;
  exit?: ExitFormValues;
  today: string;
}) {
  const t = useT();
  const [clientId, setClientId] = useState(exit?.clientId ?? 0);
  const [rows, setRows] = useState<Row[]>(() => (exit?.items.length ? exit.items.map((i) => ({ key: ++seq, ...i })) : [blank(), blank(), blank()]));
  const hints = useMemo(() => skuHints[clientId] ?? [], [skuHints, clientId]);
  const filled = rows.filter((r) => r.sku.trim() || r.boxes || r.piecesPerBox);
  const totals = exitTotals(filled);

  const set = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const onSku = (key: number, sku: string) => {
    const hint = hints.find((h) => h.sku === sku.trim().toUpperCase());
    // Un SKU que ya salió antes propone sus piezas por caja (si aún no se capturaron)
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, sku, piecesPerBox: r.piecesPerBox || hint?.piecesPerBox || 0 } : r)));
  };

  return (
    <Form action={action} successMessage={exit ? "Cambios guardados." : undefined} className="card divide-y">
      <input type="hidden" name="items" value={JSON.stringify(filled.map(({ sku, boxes, piecesPerBox }) => ({ sku, boxes, piecesPerBox })))} />

      <section className="grid gap-4 p-5 md:grid-cols-3">
        <h3 className="text-sm font-semibold md:col-span-3">{t("Datos de la salida")}</h3>
        <label className="block md:col-span-2">
          <span className="label">{t("Cliente")} *</span>
          <select name="clientId" required value={clientId || ""} onChange={(e) => setClientId(Number(e.target.value))} className="input">
            <option value="">{t("Elige el cliente…")}</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">{t("Orden / referencia")}</span>
          <input name="reference" defaultValue={exit?.reference} className="input" />
        </label>
        <label className="block">
          <span className="label">{t("Fecha")} *</span>
          <input name="date" type="date" required defaultValue={exit?.date ?? today} className="input" />
        </label>
        <label className="block">
          <span className="label">{t("Hora de salida")}</span>
          <input name="time" type="time" defaultValue={exit?.time} className="input" />
        </label>
        <label className="block">
          <span className="label">{t("Entregado por (almacén)")}</span>
          <input name="deliveredBy" defaultValue={exit?.deliveredBy} className="input" />
        </label>
        <label className="block">
          <span className="label">{t("Transportista")}</span>
          <input name="carrier" defaultValue={exit?.carrier} className="input" />
        </label>
        <label className="block">
          <span className="label">{t("Placas / unidad")}</span>
          <input name="plates" defaultValue={exit?.plates} className="input uppercase" />
        </label>
        <label className="block">
          <span className="label">{t("Recibe (conductor)")}</span>
          <input name="driverName" defaultValue={exit?.driverName} className="input" />
        </label>
      </section>

      <section className="p-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h3 className="text-sm font-semibold">{t("Mercancía entregada")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("{n} SKU", { n: filled.length })} · <strong className="text-foreground tabular-nums">{formatNumber(totals.boxes)}</strong> {t("cajas")} ·{" "}
            <strong className="text-foreground tabular-nums">{formatNumber(totals.pieces)}</strong> {t("piezas")}
          </p>
        </div>
        <datalist id="exit-skus">
          {hints.map((h) => (
            <option key={h.sku} value={h.sku} />
          ))}
        </datalist>
        <div className="overflow-x-auto">
          <table className="table min-w-[36rem]">
            <thead>
              <tr>
                <th className="w-10">{t("No.")}</th>
                <th>{t("SKU / artículo")}</th>
                <th className="w-32 text-right">{t("Cajas entregadas")}</th>
                <th className="w-32 text-right">{t("Pzas por caja")}</th>
                <th className="w-28 text-right">{t("Total pzas")}</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.key}>
                  <td className="text-muted-foreground tabular-nums">{i + 1}</td>
                  <td>
                    <input
                      value={r.sku}
                      onChange={(e) => onSku(r.key, e.target.value)}
                      list="exit-skus"
                      aria-label={t("SKU / artículo")}
                      className="input min-w-36 font-mono uppercase"
                      autoComplete="off"
                    />
                  </td>
                  <td>
                    <NumberField value={r.boxes} onValueChange={(n) => set(r.key, { boxes: n })} decimals={0} aria-label={t("Cajas entregadas")} className="input text-right tabular-nums" />
                  </td>
                  <td>
                    <NumberField value={r.piecesPerBox} onValueChange={(n) => set(r.key, { piecesPerBox: n })} decimals={0} aria-label={t("Pzas por caja")} className="input text-right tabular-nums" />
                  </td>
                  <td className="text-right font-medium tabular-nums">{exitPieces(r) ? formatNumber(exitPieces(r)) : "—"}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : [blank()]))}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-rose-600"
                      aria-label={t("Quitar renglón")}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={() => setRows((rs) => [...rs, blank()])} className="btn-secondary mt-3">
          <Plus className="size-4" /> {t("Agregar SKU")}
        </button>
      </section>

      <div className="space-y-4 p-5">
        <label className="block">
          <span className="label">{t("Observaciones")}</span>
          <textarea name="notes" rows={2} defaultValue={exit?.notes} className="input" />
        </label>
        <div className="flex justify-end">
          <SubmitButton>{exit ? t("Guardar cambios") : t("Registrar salida")}</SubmitButton>
        </div>
      </div>
    </Form>
  );
}
