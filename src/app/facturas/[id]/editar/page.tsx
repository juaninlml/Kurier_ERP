import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { updateInvoice } from "@/app/actions/invoices";
import { DocumentEditor } from "@/components/DocumentEditor";
import { PageHeader } from "@/components/kit";
import { editorData, itemsForEditor } from "@/lib/editor-data";
import { toInputDate } from "@/lib/money";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getT();
  const id = Number((await params).id);
  const inv = await prisma.invoice.findUnique({
    where: { id },
    include: { items: { orderBy: { position: "asc" } }, _count: { select: { payments: true } } },
  });
  if (!inv) notFound();
  if (inv._count.payments > 0 || inv.status === "CANCELADA") redirect(`/facturas/${id}`);
  const { clients, services, clientRates, settings, brands } = await editorData();

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={t("Editar {v0}", { v0: inv.folio })} back={{ href: `/facturas/${id}`, label: inv.folio }} />
      <DocumentEditor
        kind="invoice"
        action={updateInvoice.bind(null, id)}
        clients={clients}
        services={services}
        clientRates={clientRates}
          brands={brands}
        defaultTaxRate={settings.defaultTaxRate}
        submitLabel={t("Guardar cambios")}
        defaults={{
          clientId: inv.clientId,
          folio: inv.folio,
          brandId: inv.brandId ?? 0,
          issueDate: toInputDate(inv.issueDate),
          secondDate: toInputDate(inv.dueDate),
          notes: inv.notes,
          period: inv.period,
          volume: inv.volume,
          storage: inv.storage,
          terms: inv.terms,
          items: itemsForEditor(inv.items),
        }}
      />
    </div>
  );
}
