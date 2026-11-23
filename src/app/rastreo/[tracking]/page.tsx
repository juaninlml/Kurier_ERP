import type { Metadata } from "next";
import { Check, CircleX, PackageSearch, Truck, Warehouse } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { firstName, normalizeTracking } from "@/lib/tracking";
import { SERVICE_LEVELS, serviceLevelOf } from "@/lib/lastmile-zones";
import { TrackingShell, TrackingSearch } from "@/components/TrackingShell";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
// Página pública: que no aparezca en buscadores
export const metadata: Metadata = { title: "Rastreo de envío", robots: { index: false, follow: false } };

const TZ = "America/Mexico_City";
const when = (d: Date) => d.toLocaleString("es-MX", { timeZone: TZ, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * Rastreo público de una guía de última milla (sin iniciar sesión). Solo datos mínimos:
 * primer nombre, colonia/alcaldía y CP; nunca teléfono, dirección completa ni precio.
 */
export default async function TrackingPage({ params }: { params: Promise<{ tracking: string }> }) {
  const tracking = normalizeTracking((await params).tracking);
  const [s, settings] = await Promise.all([
    tracking ? prisma.shipment.findUnique({ where: { tracking }, include: { events: { orderBy: { at: "asc" } } } }) : null,
    getSettings(),
  ]);
  const contact = [settings.phone, settings.email].filter(Boolean).join(" · ");

  if (!s) {
    return (
      <TrackingShell contact={contact}>
        <div className="p-6 text-center">
          <PackageSearch className="mx-auto size-10 text-muted-foreground" aria-hidden />
          <h1 className="mt-3 text-lg font-semibold">No encontramos esa guía</h1>
          <p className="mt-1 text-sm text-muted-foreground">Revisa el número: tiene la forma LM-XXXX-XXXX.</p>
          <TrackingSearch className="mt-5" />
        </div>
      </TrackingShell>
    );
  }

  // Momento de cada paso: el último cambio de estatus que llevó a él
  const reached = (label: string) => [...s.events].reverse().find((e) => e.kind === "ESTATUS" && e.detail.endsWith(`→ ${label}`))?.at;
  const cancelled = s.status === "CANCELADA";
  const order = ["GENERADA", "EN_RUTA", "ENTREGADA"];
  const current = order.indexOf(s.status);
  const steps = [
    { key: "GENERADA", title: "Guía generada", text: "Tu paquete está registrado y listo para salir a ruta.", at: s.createdAt, icon: Warehouse },
    { key: "EN_RUTA", title: "En camino", text: s.attempts ? `El repartidor lleva tu paquete (${s.attempts} intento${s.attempts === 1 ? "" : "s"} sin entregar; se vuelve a intentar).` : "El repartidor lleva tu paquete.", at: s.loadedAt ?? reached("En ruta"), icon: Truck },
    { key: "ENTREGADA", title: "Entregado", text: s.receiverName ? `Recibió: ${firstName(s.receiverName)}.` : "Tu paquete fue entregado.", at: s.deliveredAt ?? reached("Entregada"), icon: Check },
  ];
  const headline = cancelled
    ? "Envío cancelado"
    : s.status === "ENTREGADA"
      ? "¡Tu paquete fue entregado!"
      : s.status === "EN_RUTA"
        ? "Tu paquete va en camino"
        : serviceLevelOf(s.serviceLevel) === "DIA_SIGUIENTE"
          ? "Tu paquete se entrega al día siguiente"
          : "Tu paquete se entrega hoy";
  const where = [s.destColony && `Col. ${s.destColony}`, s.borough, `CP ${s.destZip}`].filter(Boolean).join(", ");

  return (
    <TrackingShell contact={contact}>
      <div className="border-b px-6 py-5">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Guía {s.tracking}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{headline}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hola {firstName(s.destName)} · Entrega a domicilio · {SERVICE_LEVELS[serviceLevelOf(s.serviceLevel)].toLowerCase()}
        </p>
      </div>

      {cancelled ? (
        <div className="flex gap-3 px-6 py-5 text-sm">
          <CircleX className="mt-0.5 size-5 shrink-0 text-rose-600" aria-hidden />
          <p>Este envío fue cancelado. Si tienes dudas, contacta a {s.originCompany || s.originName || "la tienda donde compraste"}.</p>
        </div>
      ) : (
        <ol className="px-6 py-5" aria-label="Progreso del envío">
          {steps.map((st, i) => {
            const done = i <= current;
            const now = i === current;
            const Icon = st.icon;
            return (
              <li key={st.key} className="relative flex gap-4 pb-6 last:pb-0">
                {i < steps.length - 1 && <span aria-hidden className={cn("absolute top-9 left-[17px] h-[calc(100%-2.25rem)] w-0.5", i < current ? "bg-emerald-500" : "bg-border")} />}
                <span
                  className={cn(
                    "relative grid size-9 shrink-0 place-items-center rounded-full border-2",
                    done ? "border-emerald-500 bg-emerald-500 text-white" : "border-border bg-card text-muted-foreground",
                    now && s.status !== "ENTREGADA" && "ring-4 ring-emerald-500/20",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="pt-1.5">
                  <p className={cn("text-sm font-semibold", !done && "text-muted-foreground")}>
                    {st.title}
                    {now && <span className="sr-only"> (estado actual)</span>}
                  </p>
                  {done && <p className="text-sm text-muted-foreground">{st.text}</p>}
                  {done && st.at && <p className="mt-0.5 text-xs text-muted-foreground first-letter:uppercase">{when(st.at)}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <dl className="grid gap-x-6 gap-y-3 border-t px-6 py-5 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">Destino</dt>
          <dd className="font-medium">{where}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Envía</dt>
          <dd className="font-medium">{s.originCompany || s.originName}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Bultos</dt>
          <dd className="font-medium">{s.packages}</dd>
        </div>
        {s.cod > 0 && !cancelled && s.status !== "ENTREGADA" && (
          <div>
            <dt className="text-xs text-muted-foreground">Pago contra entrega</dt>
            <dd className="font-medium">${s.cod.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</dd>
          </div>
        )}
      </dl>
    </TrackingShell>
  );
}
