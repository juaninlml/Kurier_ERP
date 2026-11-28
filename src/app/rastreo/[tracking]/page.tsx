import type { Metadata } from "next";
import { Check, CircleX, PackageSearch, Truck, Warehouse } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { firstName, normalizeTracking } from "@/lib/tracking";
import { SERVICE_LEVELS, serviceLevelOf } from "@/lib/lastmile-zones";
import { TrackingShell, TrackingSearch } from "@/components/TrackingShell";
import { cn } from "@/lib/utils";
import { getLang, getT } from "@/lib/i18n/server";
import { localeOf } from "@/lib/i18n";

export const dynamic = "force-dynamic";
// Página pública: que no aparezca en buscadores
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Rastreo de envío"), robots: { index: false, follow: false } };
}

const TZ = "America/Mexico_City";
const when = (d: Date, locale: string) => d.toLocaleString(locale, { timeZone: TZ, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * Rastreo público de una guía de última milla (sin iniciar sesión). Solo datos mínimos:
 * primer nombre, colonia/alcaldía y CP; nunca teléfono, dirección completa ni precio.
 */
export default async function TrackingPage({ params }: { params: Promise<{ tracking: string }> }) {
  const tracking = normalizeTracking((await params).tracking);
  const [t, lang] = await Promise.all([getT(), getLang()]);
  const locale = localeOf(lang);
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
          <h1 className="mt-3 text-lg font-semibold">{t("No encontramos esa guía")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("Revisa el número: tiene la forma LM-XXXX-XXXX.")}</p>
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
    { key: "GENERADA", title: t("Guía generada"), text: t("Tu paquete está registrado y listo para salir a ruta."), at: s.createdAt, icon: Warehouse },
    {
      key: "EN_RUTA",
      title: t("En camino"),
      text: s.attempts ? t("El repartidor lleva tu paquete ({n} intento(s) sin entregar; se vuelve a intentar).", { n: s.attempts }) : t("El repartidor lleva tu paquete."),
      at: s.loadedAt ?? reached("En ruta"),
      icon: Truck,
    },
    { key: "ENTREGADA", title: t("Entregado"), text: s.receiverName ? t("Recibió: {v0}.", { v0: firstName(s.receiverName) }) : t("Tu paquete fue entregado."), at: s.deliveredAt ?? reached("Entregada"), icon: Check },
  ];
  const headline = cancelled
    ? t("Envío cancelado")
    : s.status === "ENTREGADA"
      ? t("¡Tu paquete fue entregado!")
      : s.status === "EN_RUTA"
        ? t("Tu paquete va en camino")
        : serviceLevelOf(s.serviceLevel) === "DIA_SIGUIENTE"
          ? t("Tu paquete se entrega al día siguiente")
          : t("Tu paquete se entrega hoy");
  const where = [s.destColony && `Col. ${s.destColony}`, s.borough, `CP ${s.destZip}`].filter(Boolean).join(", ");

  return (
    <TrackingShell contact={contact}>
      <div className="border-b px-6 py-5">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("Guía {v0}", { v0: s.tracking })}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{headline}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("Hola {v0}", { v0: firstName(s.destName) })} · {t("Entrega a domicilio")} · {t(SERVICE_LEVELS[serviceLevelOf(s.serviceLevel)]).toLowerCase()}
        </p>
      </div>

      {cancelled ? (
        <div className="flex gap-3 px-6 py-5 text-sm">
          <CircleX className="mt-0.5 size-5 shrink-0 text-rose-600" aria-hidden />
          <p>{t("Este envío fue cancelado. Si tienes dudas, contacta a {v0}.", { v0: s.originCompany || s.originName || t("la tienda donde compraste") })}</p>
        </div>
      ) : (
        <ol className="px-6 py-5" aria-label={t("Progreso del envío")}>
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
                    {now && <span className="sr-only"> ({t("estado actual")})</span>}
                  </p>
                  {done && <p className="text-sm text-muted-foreground">{st.text}</p>}
                  {done && st.at && <p className="mt-0.5 text-xs text-muted-foreground first-letter:uppercase">{when(st.at, locale)}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <dl className="grid gap-x-6 gap-y-3 border-t px-6 py-5 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">{t("Destino")}</dt>
          <dd className="font-medium">{where}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t("Envía")}</dt>
          <dd className="font-medium">{s.originCompany || s.originName}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t("Bultos")}</dt>
          <dd className="font-medium">{s.packages}</dd>
        </div>
      </dl>
    </TrackingShell>
  );
}
