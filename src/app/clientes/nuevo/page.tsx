import { createClient } from "@/app/actions/clients";
import { ClientForm } from "@/components/ClientForm";
import { PageHeader } from "@/components/kit";
import { brandOptions } from "@/lib/brands";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function NewClientPage() {
  const t = await getT();
  const brands = await brandOptions();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Nuevo cliente" back={{ href: "/clientes", label: t("Clientes") }} />
      <ClientForm action={createClient} brands={brands} />
    </div>
  );
}
