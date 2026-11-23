import { createSupplier } from "@/app/actions/suppliers";
import { SupplierForm } from "@/components/SupplierForm";
import { PageHeader } from "@/components/kit";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await getT())("Nuevo proveedor") };
}

export default async function NewSupplierPage() {
  const t = await getT();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Nuevo proveedor" back={{ href: "/proveedores", label: t("Proveedores") }} />
      <SupplierForm action={createSupplier} />
    </div>
  );
}
