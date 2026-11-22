import { prisma } from "@/lib/db";
import { createBill } from "@/app/actions/payables";
import { BillForm } from "@/components/BillForm";
import { PageHeader } from "@/components/kit";
import { addDays, toInputDate } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await getT())("Nueva cuenta por pagar") };
}

export default async function NewBillPage({ searchParams }: { searchParams: Promise<{ proveedor?: string }> }) {
  const t = await getT();
  const { proveedor } = await searchParams;
  const [suppliers, settings] = await Promise.all([
    prisma.supplier.findMany({ where: { active: true }, select: { id: true, name: true, category: true, creditDays: true }, orderBy: { name: "asc" } }),
    getSettings(),
  ]);
  // Desde la ficha de un proveedor ("Registrar factura") llega preseleccionado
  const pre = suppliers.find((s) => s.id === Number(proveedor));
  const today = new Date();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Nueva cuenta por pagar"
        subtitle={t("Registra la factura o recibo que te cobra un proveedor para dar seguimiento a su vencimiento y a sus pagos.")}
        back={pre ? { href: `/proveedores/${pre.id}`, label: pre.name } : { href: "/cuentas-por-pagar", label: t("Cuentas por pagar") }}
      />
      <BillForm
        action={createBill}
        suppliers={suppliers}
        defaultTaxRate={settings.defaultTaxRate}
        submitLabel={t("Registrar cuenta por pagar")}
        bill={{
          supplierId: pre?.id ?? null,
          folio: "",
          concept: "",
          category: pre?.category ?? "",
          issueDate: toInputDate(today),
          dueDate: toInputDate(addDays(today, pre?.creditDays ?? 0)),
          total: 0,
          tax: 0,
          notes: "",
        }}
      />
    </div>
  );
}
