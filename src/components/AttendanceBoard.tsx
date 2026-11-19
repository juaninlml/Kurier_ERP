"use client";

import Link from "next/link";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/*
 * Tablero de asistencias. Cada día es una barra sobre un mismo eje de horas para toda la semana,
 * así se comparan de un vistazo: el horario programado va como banda tenue y encima lo trabajado
 * (azul), el retardo (ámbar), la comida (hueco) y las horas extra (violeta). Mismo vocabulario
 * en "Hoy" y en la semana.
 */

export type DayStatus = "OK" | "EN_CURSO" | "FALTA" | "DESCANSO" | "PENDIENTE";

export type DayCell = {
  date: string;
  status: DayStatus;
  /** Minutos del día (hora local). */
  schedStart: number;
  schedEnd: number;
  inMin: number | null;
  outMin: number | null;
  mealFrom: number | null;
  mealTo: number | null;
  otUntil: number | null;
  workedHours: number;
  lateMin: number;
  late: boolean;
  earlyMin: number;
  overtimeMin: number;
  autoExit: boolean;
  atMeal: boolean;
};

export type EmployeeWeek = {
  id: number;
  name: string;
  detail: string;
  schedule: string;
  noKiosk: boolean;
  cells: DayCell[];
  hours: number;
  scheduledHours: number;
  lates: number;
  absences: number;
  otMin: number;
};

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.round(m % 60)).padStart(2, "0")}`;
const pct = (m: number, axis: Axis) => ((m - axis.from) / (axis.to - axis.from)) * 100;

type Axis = { from: number; to: number };

/** Eje común: de una hora antes de la primera entrada a una después de la última salida. */
export function axisFor(rows: EmployeeWeek[]): Axis {
  let from = 24 * 60,
    to = 0;
  for (const r of rows)
    for (const c of r.cells) {
      from = Math.min(from, c.schedStart, c.inMin ?? Infinity);
      to = Math.max(to, c.schedEnd, c.outMin ?? 0, c.otUntil ?? 0);
    }
  if (from >= to) return { from: 8 * 60, to: 19 * 60 };
  return { from: Math.max(0, Math.floor(from / 60) * 60 - 60), to: Math.min(24 * 60, Math.ceil(to / 60) * 60 + 60) };
}

const STATUS_LABEL: Record<DayStatus, string> = {
  OK: "Completo",
  EN_CURSO: "En turno",
  FALTA: "Falta",
  DESCANSO: "Descanso",
  PENDIENTE: "Pendiente",
};

/** Barra de un día sobre el eje común. */
function DayBar({ c, axis, nowMin, tall }: { c: DayCell; axis: Axis; nowMin?: number; tall?: boolean }) {
  const h = tall ? "h-5" : "h-3";
  if (c.status === "FALTA")
    return <div className={cn(h, "rounded-[4px] bg-rose-100 ring-1 ring-rose-300/70 ring-inset")} />;
  if (c.status === "DESCANSO") return <div className={cn(h, "hatch rounded-[4px]")} />;

  const seg = (a: number, b: number) => ({ left: `${pct(a, axis)}%`, width: `${Math.max(0, pct(b, axis) - pct(a, axis))}%` });
  const end = c.outMin ?? nowMin ?? null;
  const regEnd = end === null ? null : Math.min(end, c.schedEnd);
  const lateEnd = c.inMin !== null && c.late ? Math.min(c.inMin, c.schedEnd) : null;

  return (
    <div className={cn(h, "relative overflow-hidden rounded-[4px] bg-muted")}>
      {/* Horario programado */}
      <span className="absolute inset-y-0 bg-primary/12" style={seg(c.schedStart, c.schedEnd)} />
      {/* Retardo: del inicio del horario a la entrada */}
      {lateEnd !== null && <span className="absolute inset-y-0 bg-[var(--aging-1)]" style={seg(c.schedStart, lateEnd)} />}
      {/* Trabajado dentro del horario */}
      {c.inMin !== null && regEnd !== null && regEnd > c.inMin && (
        <span className={cn("absolute inset-y-0 bg-[var(--chart-1)]", c.status === "EN_CURSO" && "attendance-live")} style={seg(c.inMin, regEnd)} />
      )}
      {/* Horas extra */}
      {c.inMin !== null && end !== null && end > c.schedEnd && (
        <span className="absolute inset-y-0 bg-[var(--chart-4)]" style={seg(Math.max(c.schedEnd, c.inMin), end)} />
      )}
      {/* Comida: hueco sobre lo trabajado (solo dentro del tramo entre entrada y salida) */}
      {c.mealFrom !== null && c.inMin !== null && end !== null && (
        <span className="absolute inset-y-0 bg-card/85" style={seg(Math.max(c.mealFrom, c.inMin), Math.min(c.mealTo ?? end, end))} />
      )}
      {/* Ahora */}
      {nowMin !== undefined && nowMin > axis.from && nowMin < axis.to && (
        <span className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-foreground/70" style={{ left: `${pct(nowMin, axis)}%` }} />
      )}
    </div>
  );
}

function DayDetail({ c, name, label }: { c: DayCell; name: string; label: string }) {
  return (
    <div className="min-w-48 space-y-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-semibold">{name}</span>
        <span className="opacity-70 capitalize">{label}</span>
      </div>
      <div className="opacity-80">
        {STATUS_LABEL[c.status]}
        {c.atMeal && " · en comida"} · horario {hhmm(c.schedStart)}–{hhmm(c.schedEnd)}
      </div>
      {c.inMin !== null && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 tabular-nums">
          <dt className="opacity-70">Entrada</dt>
          <dd className="text-right font-medium">{hhmm(c.inMin)}</dd>
          {c.mealFrom !== null && (
            <>
              <dt className="opacity-70">Comida</dt>
              <dd className="text-right font-medium">
                {hhmm(c.mealFrom)}–{c.mealTo !== null ? hhmm(c.mealTo) : "…"}
              </dd>
            </>
          )}
          <dt className="opacity-70">Salida</dt>
          <dd className="text-right font-medium">
            {c.outMin !== null ? hhmm(c.outMin) : "—"}
            {c.autoExit && " (auto)"}
          </dd>
          <dt className="opacity-70">Trabajado</dt>
          <dd className="text-right font-medium">{c.workedHours.toFixed(1)} h</dd>
        </dl>
      )}
      {(c.late || c.overtimeMin > 0 || c.earlyMin > 0) && (
        <div className="flex flex-wrap gap-1 pt-0.5">
          {c.late && <span className="rounded bg-amber-400/25 px-1.5 py-px">Retardo {c.lateMin} min</span>}
          {c.earlyMin > 0 && c.status === "OK" && !c.autoExit && <span className="rounded bg-background/15 px-1.5 py-px">Salió {c.earlyMin} min antes</span>}
          {c.overtimeMin > 0 && <span className="rounded bg-violet-400/30 px-1.5 py-px">Extra {(c.overtimeMin / 60).toFixed(1)} h</span>}
        </div>
      )}
    </div>
  );
}

export function Legend() {
  const items: [string, string][] = [
    ["Horario", "bg-primary/15"],
    ["Trabajado", "bg-[var(--chart-1)]"],
    ["Retardo", "bg-[var(--aging-1)]"],
    ["Horas extra", "bg-[var(--chart-4)]"],
    ["Falta", "bg-rose-100 ring-1 ring-rose-300 ring-inset"],
    ["Descanso", "hatch"],
  ];
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      {items.map(([n, cls]) => (
        <li key={n} className="inline-flex items-center gap-1.5">
          <span aria-hidden className={cn("inline-block h-2.5 w-4 rounded-[3px]", cls)} />
          {n}
        </li>
      ))}
    </ul>
  );
}

/** Semana: una fila por empleado, una barra por día y el avance de horas contra lo programado. */
export function WeekGrid({ rows, days, dayLabels, today, nowMin }: { rows: EmployeeWeek[]; days: string[]; dayLabels: string[]; today: string; nowMin: number }) {
  const axis = axisFor(rows);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[1040px]">
        {/* Encabezado */}
        <div className="grid grid-cols-[minmax(180px,1.3fr)_repeat(7,minmax(0,1fr))_150px] items-end gap-x-2 border-b px-5 pt-1 pb-2 text-xs text-muted-foreground">
          <span>Empleado</span>
          {days.map((d, i) => (
            <span key={d} className={cn("rounded-md px-1 py-0.5 text-center", d === today && "bg-primary/10 font-medium text-primary")}>
              {dayLabels[i]}
            </span>
          ))}
          <span className="text-right">Horas de la semana</span>
        </div>
        <div className="grid grid-cols-[minmax(180px,1.3fr)_repeat(7,minmax(0,1fr))_150px] gap-x-2 px-5 pt-1.5 text-[10px] text-muted-foreground/80">
          <span />
          {days.map((d) => (
            <span key={d} className="flex justify-between tabular-nums">
              <span>{hhmm(axis.from).slice(0, 2)}h</span>
              <span>{hhmm(axis.to).slice(0, 2)}h</span>
            </span>
          ))}
          <span />
        </div>

        <ul className="divide-y">
          {rows.map((r) => {
            const progress = r.scheduledHours ? Math.min(1, r.hours / r.scheduledHours) : 0;
            return (
              <li key={r.id} className="grid grid-cols-[minmax(180px,1.3fr)_repeat(7,minmax(0,1fr))_150px] items-center gap-x-2 px-5 py-3 transition-colors hover:bg-muted/30">
                <div className="min-w-0">
                  <Link href={`/nomina/empleados/${r.id}`} className="block truncate text-sm font-medium text-primary hover:underline">
                    {r.name}
                  </Link>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {r.schedule}
                    {r.detail && ` · ${r.detail}`}
                    {r.noKiosk && <span className="text-amber-700"> · sin autenticador</span>}
                  </div>
                </div>
                {r.cells.map((c, i) => (
                  <Tooltip key={c.date}>
                    <TooltipTrigger asChild>
                      <Link
                        href={`/nomina/asistencias/dia?empleado=${r.id}&fecha=${c.date}`}
                        className={cn(
                          "group block rounded-md p-1 outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50",
                          c.date === today && "bg-primary/5",
                        )}
                        aria-label={`${r.name}, ${dayLabels[i]}: ${STATUS_LABEL[c.status]}${c.inMin !== null ? `, ${c.workedHours.toFixed(1)} horas` : ""}`}
                      >
                        <DayBar c={c} axis={axis} nowMin={c.date === today && c.status === "EN_CURSO" ? nowMin : undefined} />
                        <span className="mt-1 flex items-center justify-between gap-1 text-[10px] leading-none tabular-nums">
                          {c.inMin !== null ? (
                            <>
                              <span className={cn("text-muted-foreground", c.late && "font-medium text-amber-700")}>{hhmm(c.inMin)}</span>
                              <span className="font-medium text-foreground">{c.workedHours.toFixed(1)}h</span>
                            </>
                          ) : c.status === "FALTA" ? (
                            <span className="font-medium text-rose-700">Falta</span>
                          ) : c.status === "DESCANSO" ? (
                            <span className="text-muted-foreground">Descanso</span>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </span>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={6} className="block px-3 py-2">
                      <DayDetail c={c} name={r.name} label={dayLabels[i]!} />
                    </TooltipContent>
                  </Tooltip>
                ))}
                <div className="text-right">
                  <div className="text-sm font-semibold tabular-nums">
                    {r.hours.toFixed(1)}
                    <span className="font-normal text-muted-foreground"> / {r.scheduledHours.toFixed(0)} h</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="viz-grow-right h-full rounded-full bg-[var(--chart-1)]" style={{ width: `${progress * 100}%` }} />
                  </div>
                  <div className="mt-1 flex justify-end gap-1 text-[10px]">
                    {r.absences > 0 && <span className="rounded bg-rose-50 px-1 text-rose-700">{r.absences} falta{r.absences > 1 ? "s" : ""}</span>}
                    {r.lates > 0 && <span className="rounded bg-amber-50 px-1 text-amber-800">{r.lates} retardo{r.lates > 1 ? "s" : ""}</span>}
                    {r.otMin > 0 && <span className="rounded bg-violet-50 px-1 text-violet-700">+{(r.otMin / 60).toFixed(1)} h extra</span>}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export type TodayRow = { id: number; name: string; cell: DayCell };

const TODAY_GROUPS: { key: string; label: string; tone: string; match: (c: DayCell) => boolean }[] = [
  { key: "turno", label: "En turno", tone: "bg-emerald-50 text-emerald-700 ring-emerald-600/20", match: (c) => c.status === "EN_CURSO" && !c.atMeal },
  { key: "comida", label: "En comida", tone: "bg-amber-50 text-amber-800 ring-amber-600/20", match: (c) => c.status === "EN_CURSO" && c.atMeal },
  { key: "salio", label: "Ya salió", tone: "bg-slate-50 text-slate-700 ring-slate-600/20", match: (c) => c.status === "OK" },
  { key: "pendiente", label: "Sin checar", tone: "bg-blue-50 text-blue-700 ring-blue-600/20", match: (c) => c.status === "PENDIENTE" },
  { key: "falta", label: "Falta", tone: "bg-rose-50 text-rose-700 ring-rose-600/20", match: (c) => c.status === "FALTA" },
  { key: "descanso", label: "Descanso", tone: "bg-muted text-muted-foreground ring-border", match: (c) => c.status === "DESCANSO" },
];

/** Hoy: quién está, en qué momento del turno, sobre un eje de horas con la marca de "ahora". */
export function TodayBoard({ rows, nowMin }: { rows: TodayRow[]; nowMin: number }) {
  const axis = axisFor(rows.map((r) => ({ cells: [r.cell] }) as EmployeeWeek));
  const span = axis.to - axis.from;
  const step = span > 12 * 60 ? 120 : 60;
  const ticks: number[] = [];
  for (let m = Math.ceil(axis.from / step) * step; m <= axis.to; m += step) ticks.push(m);
  const nowIn = nowMin > axis.from && nowMin < axis.to;

  return (
    <div className="space-y-4">
      <ul className="flex flex-wrap gap-2">
        {TODAY_GROUPS.map((g) => {
          const n = rows.filter((r) => g.match(r.cell)).length;
          if (!n && (g.key === "comida" || g.key === "descanso" || g.key === "falta")) return null;
          return (
            <li key={g.key} className={cn("inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm ring-1 ring-inset", g.tone)}>
              <span className="text-base font-semibold tabular-nums">{n}</span>
              {g.label}
            </li>
          );
        })}
      </ul>

      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-[160px_minmax(0,1fr)_96px] items-end gap-3 pb-1.5 text-[10px] text-muted-foreground tabular-nums">
            <span />
            <div className="relative h-3.5">
              {ticks
                // La etiqueta de "ahora" gana: se ocultan las horas que chocarían con ella.
                .filter((m) => !nowIn || Math.abs(m - nowMin) > span / 14)
                .map((m) => (
                  <span key={m} className="absolute -translate-x-1/2" style={{ left: `${pct(m, axis)}%` }}>
                    {hhmm(m).slice(0, 5)}
                  </span>
                ))}
              {nowIn && (
                <span className="absolute -translate-x-1/2 rounded bg-foreground px-1 font-medium text-background" style={{ left: `${pct(nowMin, axis)}%` }}>
                  {hhmm(nowMin)}
                </span>
              )}
            </div>
            <span />
          </div>
          <ul className="relative space-y-1.5">
            {rows.map((r) => {
              const g = TODAY_GROUPS.find((x) => x.match(r.cell));
              return (
                <li key={r.id} className="grid grid-cols-[160px_minmax(0,1fr)_96px] items-center gap-3">
                  <Link href={`/nomina/asistencias/dia?empleado=${r.id}&fecha=${r.cell.date}`} className="truncate text-sm hover:text-primary hover:underline">
                    {r.name}
                  </Link>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link
                        href={`/nomina/asistencias/dia?empleado=${r.id}&fecha=${r.cell.date}`}
                        className="relative block rounded-[4px] outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                        aria-label={`${r.name}: ${g?.label ?? ""}`}
                      >
                        {/* Cuadrícula de horas */}
                        <span aria-hidden className="pointer-events-none absolute inset-0">
                          {ticks.map((m) => (
                            <span key={m} className="absolute inset-y-0 w-px bg-border/70" style={{ left: `${pct(m, axis)}%` }} />
                          ))}
                        </span>
                        <DayBar c={r.cell} axis={axis} nowMin={nowIn ? nowMin : undefined} tall />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={6} className="block px-3 py-2">
                      <DayDetail c={r.cell} name={r.name} label="hoy" />
                    </TooltipContent>
                  </Tooltip>
                  <span className={cn("justify-self-end rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset", g?.tone)}>{g?.label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
