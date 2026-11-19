import Link from "next/link";
import { headers } from "next/headers";
import { ChevronLeft, ChevronRight, Clock, MonitorSmartphone, Plus, Timer, Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser, canManageUsers } from "@/lib/current-user";
import { authorizeOvertime, createKioskDevice, deactivateKioskDevice, deleteOvertime, saveAttendanceSettings } from "@/app/actions/attendance";
import { addDaysStr, autoCloseShifts, daySummary, localParts, mondayOf } from "@/lib/attendance";
import { PageHeader, Panel, Empty, Field } from "@/components/kit";
import { Form } from "@/components/Form";
import { SubmitButton } from "@/components/SubmitButton";
import { ConfirmButton } from "@/components/ConfirmButton";
import { CopyButton } from "@/components/CopyButton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { qrSvg } from "@/lib/totp";

export const dynamic = "force-dynamic";
export const metadata = { title: "Asistencias" };

const DAY = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  const me = await getCurrentUser();
  const admin = canManageUsers(me.role);
  await autoCloseShifts();
  const s = await prisma.companySettings.findUniqueOrThrow({ where: { id: 1 } });
  const tz = s.timezone || "America/Mexico_City";
  const now = new Date();
  const { date: today, minutes: nowMin } = localParts(now, tz);
  const { semana } = await searchParams;
  const monday = mondayOf(semana && /^\d{4}-\d{2}-\d{2}$/.test(semana) ? semana : today);
  const days = Array.from({ length: 7 }, (_, i) => addDaysStr(monday, i));
  const sunday = days[6];

  const [employees, punches, auths, devices, h] = await Promise.all([
    prisma.employee.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.punch.findMany({ where: { deleted: false, workDate: { gte: monday, lte: sunday } }, orderBy: { at: "asc" } }),
    prisma.overtimeAuth.findMany({ where: { workDate: { gte: monday, lte: sunday } }, include: { employee: { select: { name: true } } }, orderBy: { workDate: "asc" } }),
    admin ? prisma.kioskDevice.findMany({ orderBy: { createdAt: "desc" } }) : [],
    headers(),
  ]);
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const qrs = new Map(
    await Promise.all(
      devices
        .filter((d) => d.active && d.activationToken)
        .map(async (d) => [d.id, await qrSvg(`${origin}/kiosco/activar/${d.activationToken}`)] as const),
    ),
  );
  const time = (d?: { at: Date }) => (d ? d.at.toLocaleTimeString("es-MX", { timeZone: tz, hour: "2-digit", minute: "2-digit" }) : "—");
  const fmtDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("es-MX", { day: "numeric", month: "short", timeZone: "UTC" });

  const rows = employees.map((e) => {
    let hours = 0,
      lates = 0,
      absences = 0,
      otMin = 0;
    const cells = days.map((d) => {
      const sum = daySummary(
        punches.filter((p) => p.employeeId === e.id && p.workDate === d),
        e,
        { dateStr: d, todayStr: today, nowMin, tz, toleranceMin: s.lateToleranceMin, otUntil: auths.find((a) => a.employeeId === e.id && a.workDate === d)?.until, startDate: e.startDate },
      );
      hours += sum.workedHours;
      if (sum.late) lates++;
      if (sum.status === "FALTA") absences++;
      otMin += sum.overtimeMin;
      return { d, sum };
    });
    return { e, cells, hours, lates, absences, otMin };
  });

  return (
    <div>
      <PageHeader
        title="Asistencias"
        subtitle="Checadas del kiosco: entrada, comida y salida. Sin horas extra autorizadas, la salida se registra sola 5 min después del horario."
        back={{ href: "/nomina", label: "Nómina" }}
        actions={
          <a href="/kiosco" target="_blank" className="btn-secondary">
            <MonitorSmartphone className="size-4" /> Abrir kiosco
          </a>
        }
      />

      <Panel
        className="mb-6"
        title={`Semana del ${fmtDay(monday)} al ${fmtDay(sunday)}`}
        action={
          <div className="flex gap-1">
            <Link href={`/nomina/asistencias?semana=${addDaysStr(monday, -7)}`} className="btn-secondary h-8 px-2" aria-label="Semana anterior">
              <ChevronLeft className="size-4" />
            </Link>
            <Link href="/nomina/asistencias" className="btn-secondary h-8 text-xs">
              Hoy
            </Link>
            <Link href={`/nomina/asistencias?semana=${addDaysStr(monday, 7)}`} className="btn-secondary h-8 px-2" aria-label="Semana siguiente">
              <ChevronRight className="size-4" />
            </Link>
          </div>
        }
      >
        {employees.length === 0 ? (
          <Empty icon={Clock}>No hay empleados activos.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table text-xs">
              <thead>
                <tr>
                  <th className="min-w-44">Empleado</th>
                  {days.map((d, i) => (
                    <th key={d} className={cn("min-w-28 text-center", d === today && "bg-primary/10 text-primary")}>
                      {DAY[i]} {fmtDay(d).split(" ")[0]}
                    </th>
                  ))}
                  <th className="text-right">Horas</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ e, cells, hours, lates, absences, otMin }) => (
                  <tr key={e.id}>
                    <td>
                      <Link href={`/nomina/empleados/${e.id}`} className="font-medium text-primary hover:underline">
                        {e.name}
                      </Link>
                      <div className="text-[11px] text-muted-foreground">
                        {e.scheduleStart}–{e.scheduleEnd}
                        {!e.kioskSecret && <span className="ml-1 text-amber-700">· sin autenticador</span>}
                      </div>
                    </td>
                    {cells.map(({ d, sum }) => (
                      <td key={d} className={cn("p-1 text-center", d === today && "bg-primary/5")}>
                        <Link href={`/nomina/asistencias/dia?empleado=${e.id}&fecha=${d}`} className="block rounded-md px-1 py-1 hover:bg-muted">
                          {sum.entrada ? (
                            <>
                              <div className="font-medium tabular-nums">
                                {time(sum.entrada)}–{sum.salida ? time(sum.salida) : "…"}
                              </div>
                              <div className="text-[10px] text-muted-foreground tabular-nums">{sum.workedHours.toFixed(1)} h</div>
                              <div className="mt-0.5 flex flex-wrap justify-center gap-0.5">
                                {sum.late && <Tag tone="rose">Retardo {sum.lateMin}m</Tag>}
                                {sum.autoExit && <Tag tone="slate">Auto</Tag>}
                                {sum.overtimeMin > 0 && <Tag tone="violet">HE {(sum.overtimeMin / 60).toFixed(1)}h</Tag>}
                                {sum.status === "EN_CURSO" && <Tag tone="emerald">En turno</Tag>}
                              </div>
                            </>
                          ) : sum.status === "FALTA" ? (
                            <Tag tone="rose">Falta</Tag>
                          ) : sum.status === "DESCANSO" ? (
                            <span className="text-[10px] text-muted-foreground">Descanso</span>
                          ) : (
                            <span className="text-muted-foreground">·</span>
                          )}
                        </Link>
                      </td>
                    ))}
                    <td className="text-right whitespace-nowrap">
                      <div className="font-semibold tabular-nums">{hours.toFixed(1)} h</div>
                      <div className="text-[10px] text-muted-foreground">
                        {absences ? `${absences} falta(s) · ` : ""}
                        {lates ? `${lates} retardo(s)` : ""}
                        {otMin ? ` · HE ${(otMin / 60).toFixed(1)} h` : ""}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Horas extra autorizadas" description="Sin autorización, después de la hora de salida no se pueden registrar horas extra.">
          {admin && (
            <Form action={authorizeOvertime} resetOnSuccess className="grid gap-3 border-b p-5 sm:grid-cols-2">
              <Field label="Empleado">
                <select name="employeeId" required className="input" defaultValue="">
                  <option value="" disabled>
                    Elegir…
                  </option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} (sale {e.scheduleEnd})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Día">
                <input name="workDate" type="date" required defaultValue={today} className="input" />
              </Field>
              <Field label="Puede quedarse hasta">
                <input name="until" type="time" required className="input" />
              </Field>
              <Field label="Motivo">
                <input name="note" className="input" placeholder="Ej. cierre de pedidos" />
              </Field>
              <div className="sm:col-span-2">
                <SubmitButton className="btn-primary">
                  <Timer className="size-4" /> Autorizar
                </SubmitButton>
              </div>
            </Form>
          )}
          {auths.length === 0 ? (
            <Empty icon={Timer}>Sin horas extra autorizadas esta semana.</Empty>
          ) : (
            <ul className="divide-y">
              {auths.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <div>
                    <div className="font-medium">{a.employee.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {fmtDay(a.workDate)} · hasta {a.until}
                      {a.note && ` · ${a.note}`}
                    </div>
                  </div>
                  {admin && (
                    <Form action={deleteOvertime.bind(null, a.id)}>
                      <ConfirmButton message="¿Quitar esta autorización de horas extra?" className="btn-danger h-8 px-2">
                        <Trash2 className="size-3.5" />
                      </ConfirmButton>
                    </Form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {admin && (
          <div className="space-y-6">
            <Panel title="Kioscos (tablets)" description="Escanea el QR con la tablet, o abre /kiosco en ella y autorízala con tu código. Queda como kiosco aunque nadie inicie sesión.">
              <Form action={createKioskDevice} resetOnSuccess className="flex flex-wrap items-end gap-2 border-b p-5">
                <Field label="Nombre de la tablet" className="min-w-48 flex-1">
                  <input name="name" required className="input" placeholder="Tablet entrada almacén" />
                </Field>
                <SubmitButton className="btn-primary">
                  <Plus className="size-4" /> Generar QR
                </SubmitButton>
              </Form>
              {devices.length === 0 ? (
                <Empty icon={MonitorSmartphone}>Aún no hay tablets autorizadas.</Empty>
              ) : (
                <ul className="divide-y">
                  {devices.map((d) => (
                    <li key={d.id} className="space-y-2 px-5 py-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="font-medium">{d.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {d.activationToken ? "Pendiente de escanear el QR en la tablet" : d.lastSeenAt ? `Activa · última conexión ${d.lastSeenAt.toLocaleString("es-MX", { timeZone: tz, dateStyle: "short", timeStyle: "short" })}` : "Autorizada"}
                          </div>
                        </div>
                        {d.active ? (
                          <Form action={deactivateKioskDevice.bind(null, d.id)}>
                            <ConfirmButton message={`¿Desactivar ${d.name}? Dejará de funcionar como kiosco.`} className="btn-danger h-8 text-xs">
                              Desactivar
                            </ConfirmButton>
                          </Form>
                        ) : (
                          <Badge variant="secondary">Desactivada</Badge>
                        )}
                      </div>
                      {d.active && d.activationToken && qrs.get(d.id) && (
                        <div className="flex items-center gap-4 rounded-lg border bg-muted/30 p-3">
                          <div className="size-32 shrink-0 rounded-md bg-white p-1.5 [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: qrs.get(d.id)! }} />
                          <p className="text-xs text-muted-foreground">
                            Escanea este QR con la <span className="font-medium text-foreground">cámara de la tablet</span> y toca «Autorizar». También puedes abrir <span className="font-mono">/kiosco</span> en la tablet y autorizarla con tu código del autenticador.
                          </p>
                        </div>
                      )}
                      {d.active && d.activationToken && (
                        <div className="flex items-center gap-2">
                          <input readOnly value={`${origin}/kiosco/activar/${d.activationToken}`} className="input h-8 min-w-0 flex-1 font-mono text-xs" aria-label="Link de autorización" />
                          <CopyButton value={`${origin}/kiosco/activar/${d.activationToken}`} />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Reglas de asistencia">
              <Form action={saveAttendanceSettings} className="grid gap-3 p-5 sm:grid-cols-3">
                <Field label="Tolerancia de retardo (min)">
                  <input name="lateToleranceMin" type="number" min="0" defaultValue={s.lateToleranceMin} className="input text-right" />
                </Field>
                <Field label="Salida automática (min después)">
                  <input name="autoCloseMin" type="number" min="0" defaultValue={s.autoCloseMin} className="input text-right" />
                </Field>
                <Field label="Pago de horas extra (× hora)">
                  <input name="overtimeRate" type="number" min="1" step="0.5" defaultValue={s.overtimeRate} className="input text-right" />
                </Field>
                <div className="sm:col-span-3">
                  <SubmitButton className="btn-secondary">Guardar reglas</SubmitButton>
                </div>
              </Form>
            </Panel>
          </div>
        )}
      </div>
    </div>
  );
}

function Tag({ children, tone }: { children: React.ReactNode; tone: "rose" | "slate" | "violet" | "emerald" }) {
  const cls = { rose: "bg-rose-50 text-rose-700", slate: "bg-slate-100 text-slate-600", violet: "bg-violet-50 text-violet-700", emerald: "bg-emerald-50 text-emerald-700" }[tone];
  return <span className={cn("rounded px-1 py-px text-[10px] font-medium whitespace-nowrap", cls)}>{children}</span>;
}
