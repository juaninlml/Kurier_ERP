import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/kit";
import { ShipmentForm } from "@/components/ShipmentForm";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await getT())("Crear envío") };
}

export default async function NewShipmentPage() {
  const t = await getT();
  const [s, addresses, clients] = await Promise.all([
    getSettings(),
    prisma.shipAddress.findMany({ orderBy: [{ alias: "asc" }, { name: "asc" }] }),
    prisma.client.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  // Origen por omisión: la dirección guardada de origen más reciente o los datos de la empresa
  const lastOrigin = addresses.filter((a) => a.kind === "ORIGEN").sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
  const defaultOrigin = lastOrigin
    ? { name: lastOrigin.name, company: lastOrigin.company, email: lastOrigin.email, phone: lastOrigin.phone, street: lastOrigin.street, number: lastOrigin.number, colony: lastOrigin.colony, city: lastOrigin.city, state: lastOrigin.state, zip: lastOrigin.zip, reference: lastOrigin.reference, rfc: lastOrigin.rfc }
    : { name: s.tradeName, company: s.legalName, email: s.email, phone: s.phone.replace(/\D/g, "").slice(-10), street: s.address, number: "", colony: "", city: s.city || "Ciudad de México", state: s.state || "CDMX", zip: s.zip, reference: "", rfc: s.rfc };
  const plain = (kind: string) =>
    addresses.filter((a) => a.kind === kind).map(({ createdAt: _c, updatedAt: _u, ...a }) => a);

  return (
    <div>
      <PageHeader title={t("Crear envío")} subtitle={t("Guía de última milla CDMX: captura origen, destino y paquete, cotiza por zona y genera la guía 4 × 6.")} back={{ href: "/envios", label: t("Envíos última milla") }} />
      <ShipmentForm origins={plain("ORIGEN")} destinations={plain("DESTINO")} clients={clients} defaultOrigin={defaultOrigin} />
    </div>
  );
}
