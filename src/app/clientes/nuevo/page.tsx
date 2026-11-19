import { createClient } from "@/app/actions/clients";
import { ClientForm } from "@/components/ClientForm";
import { PageHeader } from "@/components/kit";
import { brandOptions } from "@/lib/brands";

export const dynamic = "force-dynamic";

export default async function NewClientPage() {
  const brands = await brandOptions();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Nuevo cliente" back={{ href: "/clientes", label: "Clientes" }} />
      <ClientForm action={createClient} brands={brands} />
    </div>
  );
}
