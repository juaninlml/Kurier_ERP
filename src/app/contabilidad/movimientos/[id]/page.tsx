import { Trash2 } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { deleteTransaction, updateTransaction } from "@/app/actions/accounting";
import { PageHeader } from "@/components/kit";
import { TransactionForm } from "@/components/TransactionForm";
import { ConfirmButton } from "@/components/ConfirmButton";
import { toInputDate } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { Form } from "@/components/Form";
import { Tr } from "@/components/Tr";

export const dynamic = "force-dynamic";

export default async function TransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const tr = await getT();
  const id = Number((await params).id);
  const t = await prisma.transaction.findUnique({ where: { id }, include: { payment: true } });
  if (!t) notFound();
  if (t.payment) redirect(`/facturas/${t.payment.invoiceId}`);
  const [clients, suppliers, s] = await Promise.all([
    prisma.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.supplier.findMany({ select: { id: true, name: true, category: true }, orderBy: { name: "asc" } }),
    getSettings(),
  ]);

  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Editar movimiento" back={{ href: "/contabilidad", label: tr("Contabilidad") }} />
      <div className="card p-5">
        <TransactionForm
          action={updateTransaction.bind(null, id)}
          clients={clients}
          suppliers={suppliers}
          defaultTaxRate={s.defaultTaxRate}
          submitLabel={tr("Guardar cambios")}
          tx={{ ...t, date: toInputDate(t.date) }}
        />
        <Form action={deleteTransaction.bind(null, id)} className="mt-3">
          <ConfirmButton message={tr("¿Eliminar este movimiento?")} className="btn-danger w-full">
            <Trash2 className="size-4" /> <Tr>Eliminar movimiento</Tr>
          </ConfirmButton>
        </Form>
      </div>
    </div>
  );
}
