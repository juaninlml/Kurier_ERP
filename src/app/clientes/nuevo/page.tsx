import { createClient } from "@/app/actions/clients";
import { ClientForm } from "@/components/ClientForm";
import { PageHeader } from "@/components/kit";

export default function NewClientPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Nuevo cliente" back={{ href: "/clientes", label: "Clientes" }} />
      <ClientForm action={createClient} />
    </div>
  );
}
