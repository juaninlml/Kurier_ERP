"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleAlert, ClipboardPaste, Loader2, Search } from "lucide-react";
import { saveOrderCells, saveOrderRate } from "@/app/actions/orders";
import { saveSupplyCells } from "@/app/actions/supplies";
import { cn } from "@/lib/utils";
import { useT } from "./I18nProvider";

type Wave = { id: number; name: string; detail?: string };
/** weekOther: lo de la semana sin el día capturado. orders: órdenes del día (en la hoja de insumos, para cuadrar). */
type ClientRow = { id: number; name: string; weekOther: number; orders?: number };
type Status = "idle" | "dirty" | "saving" | "saved" | "error";

const key = (c: number, w: number) => `${c}:${w}`;
const nf = new Intl.NumberFormat("es-MX");
const SAVE_DELAY = 700;

/**
 * Hoja de captura: un renglón por cliente y una columna por oleada (órdenes) o por material (insumos).
 * Se guarda sola (al dejar de escribir) y acepta pegar un bloque copiado de Excel.
 * En insumos, la última columna cuadra las piezas contra las órdenes del día.
 */
export function OrderSheet({
  date,
  waves,
  clients,
  initial,
  kind = "orders",
}: {
  date: string;
  waves: Wave[];
  clients: ClientRow[];
  initial: Record<string, number>;
  kind?: "orders" | "supplies";
}) {
  const supplies = kind === "supplies";
  const t = useT();
  const router = useRouter();
  const [values, setValues] = useState<Record<string, number>>(initial);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const dirty = useRef(new Set<string>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const grid = useRef<HTMLTableSectionElement>(null);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    const keys = [...dirty.current];
    if (!keys.length) return;
    dirty.current.clear();
    setStatus("saving");
    const cells = keys.map((k) => {
      const [clientId, waveId] = k.split(":").map(Number);
      return { clientId, waveId, quantity: valuesRef.current[k] ?? 0 };
    });
    const r = supplies
      ? await saveSupplyCells(date, cells.map((c) => ({ clientId: c.clientId, colId: c.waveId, quantity: c.quantity })))
      : await saveOrderCells(date, cells);
    if ("error" in r) {
      keys.forEach((k) => dirty.current.add(k));
      setError(t(r.error));
      setStatus("error");
      return;
    }
    // Confirma cada celda guardada con un tinte breve (sin animación si se pidió menos movimiento).
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      for (const k of keys)
        grid.current
          ?.querySelector<HTMLInputElement>(`input[data-k="${k}"]`)
          ?.animate([{ backgroundColor: "color-mix(in oklab, var(--chart-1) 18%, transparent)" }, { backgroundColor: "transparent" }], { duration: 900, easing: "cubic-bezier(0.16,1,0.3,1)" });
    }
    setStatus(dirty.current.size ? "dirty" : "saved");
    router.refresh();
  }, [date, router, t, supplies]);

  const schedule = useCallback(() => {
    setStatus("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY);
  }, [flush]);

  // Avisa antes de salir con cambios sin guardar.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current.size) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const setCell = (k: string, raw: string) => {
    const n = raw.replace(/[^\d]/g, "");
    const v = n === "" ? 0 : Math.min(1_000_000, Number(n));
    if ((valuesRef.current[k] ?? 0) === v) return;
    setValues((s) => ({ ...s, [k]: v }));
    dirty.current.add(k);
    schedule();
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? clients.filter((c) => c.name.toLowerCase().includes(q)) : clients;
  }, [clients, query]);

  const rowTotal = (c: number) => waves.reduce((a, w) => a + (values[key(c, w.id)] ?? 0), 0);
  const colTotal = (w: number) => clients.reduce((a, c) => a + (values[key(c.id, w)] ?? 0), 0);
  const grand = clients.reduce((a, c) => a + rowTotal(c.id), 0);
  const maxRow = Math.max(1, ...clients.map((c) => rowTotal(c.id)));

  /** Mueve el foco a otra celda (fila/columna visibles). */
  const focusCell = (r: number, col: number) => {
    const el = grid.current?.querySelector<HTMLInputElement>(`input[data-r="${r}"][data-c="${col}"]`);
    if (el) {
      el.focus();
      el.select();
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>, r: number, col: number) => {
    const el = e.currentTarget;
    const atStart = el.selectionStart === 0 && el.selectionEnd === 0;
    const atEnd = el.selectionStart === el.value.length;
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      focusCell(e.shiftKey && e.key === "Enter" ? r - 1 : r + 1, col);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusCell(r - 1, col);
    } else if (e.key === "ArrowRight" && atEnd) {
      e.preventDefault();
      focusCell(r, col + 1);
    } else if (e.key === "ArrowLeft" && atStart) {
      e.preventDefault();
      focusCell(r, col - 1);
    } else if (e.key === "Escape") {
      el.blur();
    }
  };

  /** Pegar un bloque de Excel / Sheets: filas por renglón, celdas por tabulador. */
  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>, r: number, col: number) => {
    const text = e.clipboardData.getData("text");
    if (!/[\t\n]/.test(text.trim())) return;
    e.preventDefault();
    const rows = text.replace(/\r/g, "").replace(/\n$/, "").split("\n");
    const next = { ...valuesRef.current };
    rows.forEach((line, i) => {
      const c = visible[r + i];
      if (!c) return;
      line.split("\t").forEach((cell, j) => {
        const w = waves[col + j];
        if (!w) return;
        const n = cell.replace(/[^\d]/g, "");
        const k = key(c.id, w.id);
        const v = n === "" ? 0 : Number(n);
        if ((next[k] ?? 0) !== v) {
          next[k] = v;
          dirty.current.add(k);
        }
      });
    });
    setValues(next);
    schedule();
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
        <label className="relative w-full max-w-64">
          <span className="sr-only">{t("Buscar cliente")}</span>
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input className="input h-8 pl-8" placeholder={t("Buscar cliente")} value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="hidden items-center gap-1.5 md:inline-flex">
            <ClipboardPaste aria-hidden className="size-3.5" />
            {t("Puedes pegar un bloque copiado de Excel")}
          </span>
          <SaveState status={status} error={error} onRetry={flush} />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th scope="col" className="sticky left-0 z-10 min-w-44 border-b bg-card px-5 py-2.5 font-medium">
                {t("Cliente")}
              </th>
              {waves.map((w) => (
                <th key={w.id} scope="col" className={cn("border-b py-2.5 text-right align-bottom font-medium", supplies ? "w-22 min-w-22 px-2" : "w-28 min-w-28 px-3")}>
                  <span className="block leading-tight text-balance">{w.name}</span>
                  {w.detail && <span className="mt-0.5 block text-[10.5px] leading-tight font-normal text-balance text-muted-foreground/80">{w.detail}</span>}
                </th>
              ))}
              <th scope="col" className={cn("border-b border-l px-4 py-2.5 text-right font-medium", supplies ? "min-w-24" : "min-w-44")}>
                {t("Total del día")}
              </th>
              <th scope="col" className={cn("border-b px-5 py-2.5 text-right font-medium", supplies ? "min-w-40" : "min-w-24")}>
                {supplies ? t("Órdenes del día") : t("Semana")}
              </th>
            </tr>
          </thead>
          <tbody ref={grid}>
            {visible.map((c, r) => {
              const total = rowTotal(c.id);
              return (
                <tr key={c.id} className="group/row">
                  <th scope="row" className="sticky left-0 z-10 border-b bg-card px-5 py-1.5 text-left font-medium transition-colors group-focus-within/row:bg-muted group-hover/row:bg-muted/60">
                    <span className="block max-w-56 truncate">{c.name}</span>
                  </th>
                  {waves.map((w, col) => {
                    const k = key(c.id, w.id);
                    const v = values[k] ?? 0;
                    return (
                      <td key={w.id} className="border-b px-1 py-1 transition-colors group-hover/row:bg-muted/40">
                        <input
                          data-k={k}
                          data-r={r}
                          data-c={col}
                          inputMode="numeric"
                          autoComplete="off"
                          aria-label={`${c.name} · ${w.name}`}
                          value={v ? nf.format(v) : ""}
                          placeholder="0"
                          onChange={(e) => setCell(k, e.target.value)}
                          onFocus={(e) => e.currentTarget.select()}
                          onBlur={() => dirty.current.size && flush()}
                          onKeyDown={(e) => onKey(e, r, col)}
                          onPaste={(e) => onPaste(e, r, col)}
                          className={cn(
                            "h-9 w-full rounded-md border border-transparent bg-transparent px-2 text-right text-[0.95rem] tabular-nums outline-none placeholder:text-muted-foreground/35",
                            "transition-[border-color,box-shadow,background-color] duration-(--dur-feedback) hover:border-border focus:border-ring focus:bg-background focus:ring-3 focus:ring-ring/25",
                            v > 0 && "font-medium",
                          )}
                        />
                      </td>
                    );
                  })}
                  <td className="border-b border-l px-4 py-1.5 transition-colors group-hover/row:bg-muted/40">
                    <div className="flex items-center justify-end gap-3">
                      <div className={cn("h-1.5 flex-1 overflow-hidden rounded-full bg-muted", supplies && "hidden")} aria-hidden>
                        <div
                          className="h-full rounded-full transition-[width] duration-(--dur-data) ease-(--ease-out)"
                          style={{ width: `${(total / maxRow) * 100}%`, background: "var(--chart-1)" }}
                        />
                      </div>
                      <span className={cn("w-14 text-right text-base font-semibold tabular-nums", !total && "text-muted-foreground/50")}>{nf.format(total)}</span>
                    </div>
                  </td>
                  <td className="border-b px-5 py-1.5 text-right text-muted-foreground tabular-nums transition-colors group-hover/row:bg-muted/40">
                    {supplies ? <Match orders={c.orders ?? 0} pieces={total} /> : nf.format(c.weekOther + total)}
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={waves.length + 3} className="px-5 py-10 text-center text-sm text-muted-foreground">
                  {t("Ningún cliente coincide con la búsqueda.")}
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="bg-muted font-semibold">
              <th scope="row" className="sticky left-0 z-10 bg-muted px-5 py-3 text-left">
                {t("Total")}
              </th>
              {waves.map((w) => (
                <td key={w.id} className="px-3 py-3 text-right tabular-nums">
                  {nf.format(colTotal(w.id))}
                </td>
              ))}
              <td className="border-l px-4 py-3 text-right text-lg tabular-nums">{nf.format(grand)}</td>
              <td className="px-5 py-3 text-right tabular-nums">
                {supplies ? <Match orders={clients.reduce((a, c) => a + (c.orders ?? 0), 0)} pieces={grand} /> : nf.format(clients.reduce((a, c) => a + c.weekOther, 0) + grand)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/** Cuadre insumos vs. órdenes: cada paquete lleva un empaque o queda como "sin insumo". */
function Match({ orders, pieces }: { orders: number; pieces: number }) {
  const t = useT();
  const diff = pieces - orders;
  const label = !orders && !pieces ? "" : diff === 0 ? t("Cuadra") : diff < 0 ? `${t("Faltan")} ${nf.format(-diff)}` : `+${nf.format(diff)}`;
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span className="text-foreground">{nf.format(orders)}</span>
      <span
        title={diff === 0 ? t("Las piezas registradas coinciden con las órdenes") : diff < 0 ? t("Hay órdenes sin insumo registrado") : t("Hay más piezas que órdenes")}
        className={cn(
          "inline-flex h-5 min-w-16 items-center justify-center gap-1 rounded-full px-1.5 text-[11px] font-medium transition-colors duration-(--dur-state)",
          !label && "invisible",
          diff === 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800",
        )}
      >
        {diff === 0 && <Check aria-hidden className="size-3" />}
        {label || "—"}
      </span>
    </span>
  );
}

function SaveState({ status, error, onRetry }: { status: Status; error: string; onRetry: () => void }) {
  const t = useT();
  return (
    <span role="status" aria-live="polite" className="inline-flex min-w-36 items-center justify-end gap-1.5">
      {status === "dirty" && (
        <>
          <span className="size-1.5 rounded-full bg-[var(--aging-1)]" aria-hidden />
          {t("Cambios sin guardar")}
        </>
      )}
      {status === "saving" && (
        <>
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          {t("Guardando…")}
        </>
      )}
      {status === "saved" && (
        <span className="viz-fade-in inline-flex items-center gap-1.5 text-foreground">
          <Check className="size-3.5 text-emerald-600" aria-hidden />
          {t("Guardado")}
        </span>
      )}
      {status === "error" && (
        <span className="inline-flex items-center gap-1.5 text-destructive">
          <CircleAlert className="size-3.5" aria-hidden />
          {error}
          <button type="button" className="font-medium underline underline-offset-2" onClick={onRetry}>
            {t("Reintentar")}
          </button>
        </span>
      )}
      {status === "idle" && t("Se guarda automáticamente")}
    </span>
  );
}

/** Selector de fecha (o de mes) que navega al elegido. `href` lleva "{v}" donde va el valor. */
export function DateJump({ value, max, href = "/ordenes?fecha={v}", type = "date" }: { value: string; max?: string; href?: string; type?: "date" | "month" }) {
  const router = useRouter();
  const t = useT();
  return (
    <input
      type={type}
      aria-label={t(type === "month" ? "Elegir mes" : "Elegir fecha")}
      className="input h-8 w-auto"
      value={value}
      max={max}
      onChange={(e) => e.target.value && router.push(href.replace("{v}", e.target.value))}
    />
  );
}

/** Lista desplegable que navega al elegir (p. ej. el cliente). `href` lleva "{v}" donde va el valor. */
export function NavSelect({ value, options, href, label }: { value: string; options: { value: string; label: string }[]; href: string; label: string }) {
  const router = useRouter();
  const t = useT();
  return (
    <select aria-label={t(label)} className="input h-8 w-auto min-w-48" value={value} onChange={(e) => router.push(href.replace("{v}", e.target.value))}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Tarifa por paquete editable en línea (se guarda al salir del campo). */
export function RateInput({ clientId, value, fallback, fallbackLabel }: { clientId: number; value: number; fallback: number; fallbackLabel: string }) {
  const t = useT();
  const router = useRouter();
  const [v, setV] = useState(value ? String(value) : "");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const save = async () => {
    const n = v.trim() === "" ? 0 : Number(v.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) return setState("error");
    if (n === value) return;
    setState("saving");
    const r = await saveOrderRate(clientId, n);
    setState("error" in r ? "error" : "saved");
    router.refresh();
  };
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative">
        <span aria-hidden className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-xs text-muted-foreground">
          $
        </span>
        <input
          inputMode="decimal"
          aria-label={t("Tarifa por paquete")}
          title={!value && fallback ? t(fallbackLabel) : undefined}
          className={cn("input h-8 w-24 pl-5 text-right tabular-nums", state === "error" && "border-destructive")}
          value={v}
          placeholder={fallback ? fallback.toFixed(2) : "0.00"}
          onChange={(e) => {
            setV(e.target.value);
            setState("idle");
          }}
          onBlur={save}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        />
      </span>
      <span className="w-4" aria-hidden>
        {state === "saving" && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
        {state === "saved" && <Check className="viz-fade-in size-3.5 text-emerald-600" />}
      </span>
    </span>
  );
}
