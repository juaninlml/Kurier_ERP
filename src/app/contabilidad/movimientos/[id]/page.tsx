import { Trash2 } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { deleteTransaction, updateTransaction } from "@/app/actions/accounting";
import { PageHeader } from "@/components/kit";
import { TransactionForm } from "@/components/TransactionForm";
import { ConfirmButton } from "@/components/ConfirmButton";
import { toInputDate } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { Form } from "@/components/Form";

export const dynamic = "force-dynamic";

export default async function TransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const t = await prisma.transaction.findUnique({ where: { id }, include: { payment: true } });
  if (!t) notFound();
  if (t.payment) redirect(`/facturas/${t.payment.invoiceId}`);
  const [clients, s] = await Promise.all([
    prisma.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getSettings(),
  ]);

  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Editar movimiento" back={{ href: "/contabilidad", label: "Contabilidad" }} />
      <div className="card p-5">
        <TransactionForm
          action={updateTransaction.bind(null, id)}
          clients={clients}
          defaultTaxRate={s.defaultTaxRate}
          submitLabel="Guardar cambios"
          tx={{ ...t, date: toInputDate(t.date) }}
        />
        <Form action={deleteTransaction.bind(null, id)} className="mt-3">
          <ConfirmButton message="¿Eliminar este movimiento?" className="btn-danger w-full">
            <Trash2 className="size-4" /> Eliminar movimiento
          </ConfirmButton>
        </Form>
      </div>
    </div>
  );
}
