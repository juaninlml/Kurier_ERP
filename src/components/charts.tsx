"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUp, BarChart3, Table2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLang, useT } from "./I18nProvider";
import { localeOf } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/*
 * Gráficas propias (sin librería): HTML + CSS, para que escalen con el layout y la
 * tipografía del ERP. Reglas: barras delgadas con punta redondeada de 4px y base recta,
 * 2px de aire entre marcas, cuadrícula de 1px, texto siempre en tinta (nunca del color
 * de la serie), tooltip en hover y foco, y vista de tabla para cada gráfica.
 */

/** Tope del escalonado de las entradas de gráficas (igual a --viz-stagger-cap). */
const STAGGER_CAP = 160;

export type Series = { key: string; name: string; color: string };
export type ColumnPoint = { key: string; label: string; full: string; values: Record<string, number> };

// Igual que formatMoney: el peso siempre se escribe "$1,234.00", también en inglés.
const mxn = (_locale: string) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
/**
 * Monto corto para ejes: $0 · $950 · $12.5k · $1.2M. Se arma a mano porque el formato
 * compacto de Intl cambia entre Node y el navegador (y desajusta la hidratación).
 */
function compactMoney(locale: string) {
  const n = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  return (v: number) => {
    const a = Math.abs(v);
    const s = v < 0 ? "−" : "";
    if (a >= 1e6) return `${s}$${n.format(a / 1e6)}M`;
    if (a >= 1e3) return `${s}$${n.format(a / 1e3)}k`;
    return `${s}$${n.format(a)}`;
  };
}

function useMoney() {
  const locale = localeOf(useLang());
  return useMemo(() => ({ full: mxn(locale).format, compact: compactMoney(locale) }), [locale]);
}

/** Escala "bonita": 0 y 3–5 marcas redondas que cubren el máximo. */
function niceTicks(max: number, count = 4) {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}

function Swatch({ color, className }: { color: string; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-2.5 shrink-0 rounded-[3px]", className)} style={{ background: color }} />;
}

export function Legend({ items, className }: { items: { name: string; color: string; value?: string }[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground", className)}>
      {items.map((i) => (
        <li key={i.name} className="inline-flex items-center gap-1.5">
          <Swatch color={i.color} />
          <span>{i.name}</span>
          {i.value && <span className="font-medium text-foreground tabular-nums">{i.value}</span>}
        </li>
      ))}
    </ul>
  );
}

/** Botón para alternar entre gráfica y tabla. */
function ViewToggle({ table, onChange }: { table: boolean; onChange: (v: boolean) => void }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={() => onChange(!table)}
      className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
      aria-pressed={table}
    >
      {table ? <BarChart3 className="size-3.5" /> : <Table2 className="size-3.5" />}
      {table ? t("Ver gráfica") : t("Ver tabla")}
    </button>
  );
}

/**
 * Columnas agrupadas (una o varias series en el mismo eje). El tooltip lista todas
 * las series del punto; `diff` agrega un renglón calculado (p. ej. neto = ingresos − egresos).
 */
export function ColumnChart({
  points,
  series,
  height = 220,
  diff,
  emptyText,
  className,
}: {
  points: ColumnPoint[];
  series: Series[];
  height?: number;
  /** Renglón calculado en tooltip y tabla: values[plus] − values[minus]. */
  diff?: { label: string; plus: string; minus: string };
  emptyText?: string;
  className?: string;
}) {
  const t = useT();
  const money = useMoney();
  const [table, setTable] = useState(false);
  const max = Math.max(0, ...points.flatMap((p) => series.map((s) => p.values[s.key] ?? 0)));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const empty = max === 0;
  // Con muchos puntos, solo se rotulan algunos en el eje X.
  const every = points.length > 16 ? Math.ceil(points.length / 8) : 1;
  const barMax = series.length > 1 ? 14 : 24;
  const stagger = points.length > 1 ? STAGGER_CAP / (points.length - 1) : 0;
  const extra = (p: ColumnPoint) =>
    diff ? { label: diff.label, value: Math.round(((p.values[diff.plus] ?? 0) - (p.values[diff.minus] ?? 0)) * 100) / 100 } : null;

  return (
    <div className={className}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {series.length > 1 ? <Legend items={series} /> : <span />}
        <ViewToggle table={table} onChange={setTable} />
      </div>

      {table ? (
        <div
          className="overflow-auto rounded-lg border outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          style={{ height }}
          tabIndex={0}
          role="region"
          aria-label={t("Tabla de valores")}
        >
          <table className="table">
            <thead>
              <tr>
                <th>{t("Periodo")}</th>
                {series.map((s) => (
                  <th key={s.key} className="text-right">
                    {s.name}
                  </th>
                ))}
                {diff && <th className="text-right">{diff.label}</th>}
              </tr>
            </thead>
            <tbody>
              {points.map((p) => {
                const x = extra(p);
                return (
                  <tr key={p.key}>
                    <td className="capitalize">{p.full}</td>
                    {series.map((s) => (
                      <td key={s.key} className="text-right tabular-nums">
                        {money.full(p.values[s.key] ?? 0)}
                      </td>
                    ))}
                    {x && <td className="text-right font-medium tabular-nums">{money.full(x.value)}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative pl-14" style={{ height }} role="group" aria-label={t("Gráfica de columnas; usa «Ver tabla» para leer los valores.")}>
          {/* Cuadrícula y eje Y */}
          <div className="pointer-events-none absolute inset-y-0 right-0 left-0 bottom-6" aria-hidden>
            {ticks.map((v) => (
              <div key={v} className="absolute right-0 left-0 flex items-center" style={{ bottom: `${(v / top) * 100}%` }}>
                <span className="w-12 shrink-0 -translate-y-px pr-2 text-right text-[11px] leading-none text-muted-foreground tabular-nums">
                  {empty && v > 0 ? "" : money.compact(v)}
                </span>
                <span className={cn("h-px flex-1", v === 0 ? "bg-border" : "bg-border/60")} />
              </div>
            ))}
          </div>

          {empty && (
            <div className="absolute inset-0 bottom-6 left-14 grid place-items-center text-sm text-muted-foreground">
              {emptyText ?? t("Sin datos en este periodo.")}
            </div>
          )}

          {/* Columnas */}
          <div className="absolute inset-y-0 right-0 left-14 flex">
            {points.map((p, i) => {
              const x = extra(p);
              return (
                <Tooltip key={p.key}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="group relative flex h-full min-w-0 flex-1 cursor-default flex-col items-stretch outline-none"
                      aria-label={`${p.full}: ${series.map((s) => `${s.name} ${money.full(p.values[s.key] ?? 0)}`).join(", ")}`}
                    >
                      <span className="relative flex flex-1 items-end justify-center gap-[2px] rounded-md px-[12%] transition-colors group-hover:bg-muted/60 group-focus-visible:bg-muted/60 group-focus-visible:ring-2 group-focus-visible:ring-ring/40">
                        {series.map((s) => {
                          const v = p.values[s.key] ?? 0;
                          return (
                            <span
                              key={s.key}
                              className="viz-grow-up w-full rounded-t-[4px] transition-[height,filter] duration-300 ease-out group-hover:brightness-110"
                              style={
                                {
                                  maxWidth: barMax,
                                  height: `${(v / top) * 100}%`,
                                  minHeight: v > 0 ? 2 : 0,
                                  background: s.color,
                                  "--viz-delay": `${Math.round(Math.min(i * stagger, STAGGER_CAP))}ms`,
                                } as React.CSSProperties
                              }
                            />
                          );
                        })}
                      </span>
                      <span
                        className={cn(
                          "block h-6 truncate pt-1.5 text-center text-[11px] leading-none text-muted-foreground capitalize",
                          every === 1 && points.length > 8 && i % 2 === 1 && "max-sm:invisible",
                        )}
                      >
                        {i % every === 0 ? p.label : ""}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={4} className="block min-w-44 px-3 py-2">
                    <div className="mb-1.5 text-[11px] capitalize opacity-70">{p.full}</div>
                    <div className="space-y-1">
                      {series.map((s) => (
                        <div key={s.key} className="flex items-center justify-between gap-4">
                          <span className="inline-flex items-center gap-1.5 opacity-80">
                            <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ background: s.color }} />
                            {s.name}
                          </span>
                          <span className="font-semibold tabular-nums">{money.full(p.values[s.key] ?? 0)}</span>
                        </div>
                      ))}
                      {x && (
                        <div className="mt-1 flex items-center justify-between gap-4 border-t border-background/15 pt-1">
                          <span className="opacity-80">{x.label}</span>
                          <span className="font-semibold tabular-nums">{money.full(x.value)}</span>
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export type Part = { key: string; name: string; value: number; color: string; href?: string; hint?: string; ink?: "light" | "dark" };

/** Barra segmentada: un total dividido en partes, con su participación dentro de cada bloque. */
export function SegmentedBar({ parts, emptyText, format = "money" }: { parts: Part[]; emptyText?: string; format?: "money" | "count" }) {
  const t = useT();
  const money = useMoney();
  const fmt = (v: number) => (format === "money" ? money.full(v) : String(v));
  const total = parts.reduce((a, p) => a + p.value, 0);
  const visible = parts.filter((p) => p.value > 0);

  return (
    <div>
      {total <= 0 ? (
        <div className="grid h-7 place-items-center rounded-[4px] bg-muted text-xs text-muted-foreground">{emptyText ?? t("Sin datos.")}</div>
      ) : (
        <div className="viz-grow-right flex h-7 gap-[2px]" role="group" aria-label={visible.map((p) => `${p.name}: ${fmt(p.value)}`).join(", ")}>
          {visible.map((p) => {
            const share = p.value / total;
            const block = (
              <span
                className="flex h-full w-full min-w-[3px] items-center overflow-hidden rounded-[4px] px-2 text-[11px] font-semibold tabular-nums transition-[filter] hover:brightness-110"
                style={{ background: p.color, color: p.ink === "dark" ? "#1c1917" : "#fff" }}
              >
                {share >= 0.12 ? `${Math.round(share * 100)}%` : ""}
              </span>
            );
            return (
              <Tooltip key={p.key}>
                <TooltipTrigger asChild>
                  {p.href ? (
                    <Link href={p.href} className="flex outline-none focus-visible:ring-2 focus-visible:ring-ring/50" style={{ flexGrow: share, flexBasis: 0 }}>
                      {block}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="flex cursor-default outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      style={{ flexGrow: share, flexBasis: 0 }}
                    >
                      {block}
                    </button>
                  )}
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={4} className="block px-3 py-2">
                  <div className="text-sm font-semibold tabular-nums">{fmt(p.value)}</div>
                  <div className="opacity-80">
                    {p.name} · {Math.round(share * 100)}%{p.hint ? ` · ${p.hint}` : ""}
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      )}
      <ul className="mt-3 grid gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center justify-between gap-2">
            <span className="inline-flex min-w-0 items-center gap-1.5 text-muted-foreground">
              <Swatch color={p.color} />
              <span className="truncate">{p.name}</span>
              {p.hint && <span className="text-muted-foreground/70">({p.hint})</span>}
            </span>
            <span className="font-medium tabular-nums">{fmt(p.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Lista de barras horizontales con valor y participación (ranking, categorías). */
export function BarList({
  rows,
  color,
  total,
  emptyText,
}: {
  rows: { key: string; label: string; value: number; href?: string; hint?: string }[];
  color: string;
  /** Si se da, muestra el % de cada fila sobre este total. */
  total?: number;
  emptyText?: string;
}) {
  const t = useT();
  const money = useMoney();
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted-foreground">{emptyText ?? t("Sin datos.")}</p>;
  return (
    <ul className="space-y-3.5">
      {rows.map((r, i) => {
        const label = r.href ? (
          <Link href={r.href} className="truncate hover:text-primary hover:underline">
            {r.label}
          </Link>
        ) : (
          <span className="truncate">{r.label}</span>
        );
        return (
          <li key={r.key}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-baseline gap-1.5">
                {label}
                {r.hint && <span className="shrink-0 text-xs text-muted-foreground">{r.hint}</span>}
              </span>
              <span className="shrink-0 tabular-nums">
                {money.full(r.value)}
                {total ? (
                  <span className="ml-1.5 inline-block w-9 text-right text-xs text-muted-foreground">{Math.round((r.value / total) * 100)}%</span>
                ) : null}
              </span>
            </div>
            <div className="h-2 rounded-r-[4px] bg-muted">
              <div
                className="viz-grow-right h-2 rounded-r-[4px] transition-[width] duration-500 ease-out"
                style={{ width: `${(r.value / max) * 100}%`, background: color, "--viz-delay": `${Math.min(i * 30, STAGGER_CAP)}ms` } as React.CSSProperties}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const HEAT = ["var(--heat-0)", "var(--heat-1)", "var(--heat-2)", "var(--heat-3)", "var(--heat-4)"];

/** Mapa de calor tipo calendario: una columna por semana, de lunes a domingo. */
export function ActivityHeatmap({ days }: { days: { date: string; count: number; future: boolean }[] }) {
  const t = useT();
  const locale = localeOf(useLang());
  const max = Math.max(1, ...days.map((d) => d.count));
  const level = (c: number) => (c === 0 ? 0 : Math.min(4, Math.ceil((c / max) * 4)));
  const weeks = Array.from({ length: Math.ceil(days.length / 7) }, (_, w) => days.slice(w * 7, w * 7 + 7));
  const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const month = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(locale, { month: "short", timeZone: "UTC" }).replace(".", "");
  const DOW = [t("Lun"), "", t("Mié"), "", t("Vie"), "", ""];
  const DOW_FULL = [t("lunes"), t("martes"), t("miércoles"), t("jueves"), t("viernes"), t("sábado"), t("domingo")];
  const past = days.filter((d) => !d.future);
  const thisWeek = weeks[weeks.length - 1]!.reduce((a, d) => a + d.count, 0);
  const lastWeek = weeks.length > 1 ? weeks[weeks.length - 2]!.reduce((a, d) => a + d.count, 0) : 0;
  const avg = past.length ? (past.reduce((a, d) => a + d.count, 0) / past.length) * 7 : 0;
  const byDow = Array.from({ length: 7 }, (_, i) => past.filter((_, j) => j % 7 === i).reduce((a, d) => a + d.count, 0));
  const busiest = byDow.indexOf(Math.max(...byDow));

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0 flex-1">
        <div className="overflow-x-auto pb-1">
          <div
            className="grid gap-[3px] text-[10px] leading-none text-muted-foreground"
            style={{
              gridTemplateColumns: `auto repeat(${weeks.length}, minmax(11px, 1fr))`,
              gridTemplateRows: "auto repeat(7, auto)",
              gridAutoFlow: "column",
              maxWidth: weeks.length * 30 + 40,
            }}
          >
            <span />
            {DOW.map((d, i) => (
              <span key={i} className="flex items-center pr-1.5">
                {d}
              </span>
            ))}
            {weeks.flatMap((w, wi) => {
              const first = w[0]!.date;
              const showMonth = wi === 0 || first.slice(5, 7) !== weeks[wi - 1]![0]!.date.slice(5, 7);
              return [
                <span key={`m${first}`} className="h-4 whitespace-nowrap capitalize">
                  {showMonth ? month(first) : ""}
                </span>,
                ...w.map((d) =>
                  d.future ? (
                    <span key={d.date} className="aspect-square rounded-[3px]" aria-hidden />
                  ) : (
                    <Tooltip key={d.date}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label={`${fmt(d.date)}: ${d.count}`}
                          className="viz-fade-in aspect-square cursor-default rounded-[3px] outline-none hover:ring-2 hover:ring-foreground/25 focus-visible:ring-2 focus-visible:ring-ring"
                          style={{ background: HEAT[level(d.count)], "--viz-delay": `${Math.round((wi / weeks.length) * STAGGER_CAP)}ms` } as React.CSSProperties}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="top" sideOffset={4}>
                        <span className="font-semibold tabular-nums">{d.count}</span>
                        <span className="capitalize opacity-80">
                          {d.count === 1 ? t("registro") : t("registros")} · {fmt(d.date)}
                        </span>
                      </TooltipContent>
                    </Tooltip>
                  ),
                ),
              ];
            })}
          </div>
        </div>
        <div className="mt-2 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
          {t("Menos")}
          {HEAT.map((c) => (
            <span key={c} className="size-2.5 rounded-[3px]" style={{ background: c }} aria-hidden />
          ))}
          {t("Más")}
        </div>
      </div>
      <dl className="grid shrink-0 grid-cols-3 gap-4 text-sm lg:w-44 lg:grid-cols-1 lg:gap-3.5 lg:border-l lg:pl-5">
        <div>
          <dt className="text-xs text-muted-foreground">{t("Esta semana")}</dt>
          <dd className="mt-0.5 flex items-baseline gap-1.5 text-lg font-semibold">
            {thisWeek}
            <span className="text-xs font-normal text-muted-foreground">{t("vs. {n} la anterior", { n: lastWeek })}</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t("Promedio semanal")}</dt>
          <dd className="mt-0.5 text-lg font-semibold">{avg.toFixed(1)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t("Día más activo")}</dt>
          <dd className="mt-0.5 text-lg font-semibold capitalize">{byDow[busiest] ? DOW_FULL[busiest] : "—"}</dd>
        </div>
      </dl>
    </div>
  );
}

/** Variación contra el periodo anterior: flecha + porcentaje; `goodWhenUp` decide el tono. */
export function Delta({ pct, goodWhenUp = true, label }: { pct: number | null; goodWhenUp?: boolean; label?: string }) {
  if (pct === null) return null;
  const up = pct > 0;
  const flat = Math.abs(pct) < 0.5;
  const good = flat ? null : up === goodWhenUp;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
        good === null ? "bg-muted text-muted-foreground" : good ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700",
      )}
    >
      {flat ? <ArrowRight className="size-3" aria-hidden /> : up ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />}
      {Math.abs(pct).toFixed(Math.abs(pct) < 10 ? 1 : 0)}%{label && <span className="ml-1 font-normal opacity-80">{label}</span>}
    </span>
  );
}
