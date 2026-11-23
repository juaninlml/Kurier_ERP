import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, FileText, MessageCircle, Printer } from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
import { siteOrigin, trackingUrl, whatsappLink, whatsappMessage } from "@/lib/tracking";
import { prisma } from "@/lib/db";
import { setShipmentStatus, updateRecipient } from "@/app/actions/shipments";
import { PageHeader, Panel, StatusBadge } from "@/components/kit";
import { Form } from "@/components/Form";
import { SubmitButton } from "@/components/SubmitButton";
import { RecipientDialog } from "@/components/RecipientDialog";
import { SERVICE_LEVELS, SHIPMENT_STATUS, serviceLevelOf, volumetricKg } from "@/lib/lastmile-zones";
import { formatDate, formatMoney } from "@/lib/money";
import { Tr } from "@/components/Tr";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

const NEXT: Record<string, string[]> = {
  GENERADA: ["EN_RUTA", "ENTREGADA", "CANCELADA"],
  EN_RUTA: ["ENTREGADA", "GENERADA", "CANCELADA"],
  ENTREGADA: ["EN_RUTA"],
  CANCELADA: ["GENERADA"],
};
const phone = (p: string) => (p.length === 10 ? `${p.slice(0, 2)} ${p.slice(2, 6)} ${p.slice(6)}` : p);

export default async function ShipmentPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getT();
  const id = Number((await params).id);
  const s = await prisma.shipment.findUnique({
    where: { id },
    include: { client: { select: { id: true, name: true } }, events: { orderBy: { at: "desc" } }, proof: { select: { createdAt: true } } },
  });
  if (!s) notFound();
  const locked = s.status === "ENTREGADA" || s.status === "CANCELADA";
  const url = trackingUrl(await siteOrigin(), s.tracking);
  const wa = whatsappLink(s.destPhone, whatsappMessage(s, url));
  const vol = volumetricKg(s.lengthCm, s.widthCm, s.heightCm);
  const rows = (r: [string, string][]) => (
    <dl className="divide-y text-sm">
      {r
        .filter(([, v]) => v)
        .map(([k, v]) => (
          <div key={k} className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-3 px-5 py-2">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-medium break-words">{v}</dd>
          </div>
        ))}
    </dl>
  );

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={s.tracking}
        back={{ href: "/envios", label: t("Envíos última milla") }}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={s.status} />
            <span>
              {t(SERVICE_LEVELS[serviceLevelOf(s.serviceLevel)])} · {s.borough} · <Tr>Zona</Tr> {s.zone} · {formatMoney(s.price)} <Tr>sin IVA</Tr> · {formatDate(s.createdAt)}
            </span>
            {s.client && (
              <Link href={`/clientes/${s.client.id}`} className="text-primary hover:underline">
                {s.client.name}
              </Link>
            )}
          </span>
        }
        actions={
          <>
            <a href={`/api/pdf/guia/${s.id}?formato=carta`} target="_blank" className="btn-secondary">
              <FileText className="size-4" /> <Tr>Hoja carta</Tr>
            </a>
            <a href={`/api/pdf/guia/${s.id}`} target="_blank" className="btn-primary">
              <Printer className="size-4" /> <Tr>Imprimir guía 4×6</Tr>
            </a>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {(s.proof || s.loadedAt || s.attempts > 0) && (
            <Panel title="Reparto" description={t("Escaneos de la app de reparto: carga al vehículo, intentos y entrega con firma y foto.")}>
              {rows([
                [t("Cargada al vehículo"), s.loadedAt ? `${s.loadedAt.toLocaleString("es-MX", { timeZone: "America/Mexico_City", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · ${s.loadedBy}` : ""],
                [t("Intentos sin entregar"), s.attempts ? String(s.attempts) : ""],
                [t("Entregada"), s.deliveredAt ? `${s.deliveredAt.toLocaleString("es-MX", { timeZone: "America/Mexico_City", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}${s.deliveredBy ? ` · ${s.deliveredBy}` : ""}` : ""],
                [t("Recibió"), s.receiverName],
              ])}
              {s.proof && (
                <div className="grid gap-4 border-t p-5 sm:grid-cols-2">
                  <figure>
                    <a href={`/api/envios/${s.id}/evidencia?tipo=foto`} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/envios/${s.id}/evidencia?tipo=foto`} alt={t("Foto de la entrega")} className="aspect-[4/3] w-full rounded-lg border object-cover" />
                    </a>
                    <figcaption className="mt-1 text-xs text-muted-foreground">{t("Foto de la entrega")}</figcaption>
                  </figure>
                  <figure>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/envios/${s.id}/evidencia?tipo=firma`} alt={t("Firma de quien recibió")} className="aspect-[4/3] w-full rounded-lg border bg-white object-contain" />
                    <figcaption className="mt-1 text-xs text-muted-foreground">{t("Firma de {v0}", { v0: s.receiverName || t("quien recibió") })}</figcaption>
                  </figure>
                </div>
              )}
            </Panel>
          )}
          <Panel
            title="Destinatario"
            action={!locked && <RecipientDialog action={updateRecipient.bind(null, s.id)} value={{ destName: s.destName, destCompany: s.destCompany, destEmail: s.destEmail, destPhone: s.destPhone, destStreet: s.destStreet, destNumber: s.destNumber, destColony: s.destColony, destCity: s.destCity, destState: s.destState, destZip: s.destZip, destRef: s.destRef }} />}
          >
            {rows([
              [t("Nombre"), s.destName],
              [t("Empresa"), s.destCompany],
              [t("Teléfono"), phone(s.destPhone)],
              [t("Email"), s.destEmail],
              [t("Dirección"), [`${s.destStreet} ${s.destNumber}`.trim(), s.destColony && `Col. ${s.destColony}`, `${s.destCity}, ${s.destState} ${s.destZip}`].filter(Boolean).join(", ")],
              [t("Alcaldía"), `${s.borough} · ${t("Zona {v0}", { v0: s.zone })}`],
              [t("Referencia"), s.destRef],
            ])}
          </Panel>
          <div className="grid gap-6 md:grid-cols-2">
            <Panel title="Origen">
              {rows([
                [t("Nombre"), s.originName],
                [t("Empresa"), s.originCompany],
                [t("Teléfono"), phone(s.originPhone)],
                [t("Dirección"), [`${s.originStreet} ${s.originNumber}`.trim(), s.originColony && `Col. ${s.originColony}`, `${s.originCity} ${s.originZip}`].filter(Boolean).join(", ")],
                [t("RFC"), s.originRfc],
              ])}
            </Panel>
            <Panel title="Paquete">
              {rows([
                [t("Servicio"), t(SERVICE_LEVELS[serviceLevelOf(s.serviceLevel)])],
                [t("Tipo"), s.packageType === "SOBRE" ? t("Sobre") : t("Caja")],
                [t("Contenido"), s.content],
                [t("Medidas"), s.lengthCm ? `${s.lengthCm} × ${s.widthCm} × ${s.heightCm} cm` : ""],
                [t("Peso"), s.weightKg ? `${s.weightKg} kg${vol ? ` · ${t("volumétrico")} ${vol} kg` : ""}` : ""],
                [t("Bultos"), String(s.packages)],
                [t("Pago contra entrega"), s.cod ? formatMoney(s.cod) : ""],
                [t("Tarifa"), `${s.priceLabel} · ${formatMoney(s.price)}`],
                [t("Notas"), s.notes],
              ])}
            </Panel>
          </div>
        </div>

        <aside className="space-y-6">
          <Panel title="Avisar al destinatario" description={t("Abre WhatsApp con el mensaje y el link de rastreo ya escritos; solo da Enviar.")} bodyClassName="space-y-3 p-5">
            <a href={wa} target="_blank" rel="noreferrer" className="btn-kurier w-full">
              <MessageCircle className="size-4" /> {t("Enviar por WhatsApp")}
            </a>
            <div className="flex items-center gap-1.5">
              <input readOnly value={url} aria-label={t("Link de rastreo")} className="input h-8 min-w-0 flex-1 font-mono text-xs" />
              <CopyButton value={url} label={t("Copiar link")} />
              <a href={url} target="_blank" rel="noreferrer" aria-label={t("Abrir rastreo")} className="inline-grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
                <ExternalLink className="size-4" />
              </a>
            </div>
            <p className="text-[11px] text-muted-foreground">{t("El mensaje cambia con el estatus: manda uno al generar, otro al salir a ruta y otro al entregar.")}</p>
          </Panel>
          <Panel title="Estatus" bodyClassName="flex flex-wrap gap-2 p-5">
            {(NEXT[s.status] ?? []).map((st) => (
              <Form key={st} action={setShipmentStatus.bind(null, s.id, st)}>
                <SubmitButton className={st === "CANCELADA" ? "btn-danger h-9" : st === "ENTREGADA" ? "btn-kurier h-9" : "btn-secondary h-9"} pendingText="…">
                  {t(st === "GENERADA" ? "Regresar a generada" : `Marcar: ${SHIPMENT_STATUS[st]}`)}
                </SubmitButton>
              </Form>
            ))}
          </Panel>
          <Panel title="Bitácora">
            <ol className="divide-y text-sm">
              {s.events.map((e) => (
                <li key={e.id} className="px-5 py-2.5">
                  <div className="flex justify-between gap-2 text-[11px] text-muted-foreground">
                    <span>{e.by || "—"}</span>
                    <time>{e.at.toLocaleString("es-MX", { timeZone: "America/Mexico_City", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time>
                  </div>
                  <div className="mt-0.5">{e.detail}</div>
                </li>
              ))}
            </ol>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
