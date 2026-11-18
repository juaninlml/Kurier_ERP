import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { updateService } from "@/app/actions/services";
import { PageHeader } from "@/components/kit";
import { SubmitButton } from "@/components/SubmitButton";
import { ServiceFields } from "@/components/ServiceFields";
import { getSettings } from "@/lib/settings";
import { Form } from "@/components/Form";

export const dynamic = "force-dynamic";

export default async function ServicePage({ params }: { params: Promise<{ id: string }> }) {
  const [sv, sections, s] = await Promise.all([
    prisma.service.findUnique({ where: { id: Number((await params).id) } }),
    prisma.serviceSection.findMany({ orderBy: { sortOrder: "asc" } }),
    getSettings(),
  ]);
  if (!sv) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={sv.name} subtitle={`${sv.code}${sv.section ? ` · ${sv.section}` : ""}`} back={{ href: "/servicios", label: "Tarifario" }} />
      <Form action={updateService.bind(null, sv.id)} className="card space-y-4 p-5">
        <ServiceFields sv={sv} sections={sections.map((x) => x.name)} defaultTaxRate={s.defaultTaxRate} />
        <p className="text-xs text-muted-foreground">Los cambios aplican a cotizaciones y facturas nuevas; los documentos ya emitidos conservan sus precios.</p>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={sv.active} /> Activo
          </label>
          <SubmitButton>Guardar</SubmitButton>
        </div>
      </Form>
    </div>
  );
}
