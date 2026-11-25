import { createExit } from "@/app/actions/goods-exits";
import { ExitForm } from "@/components/ExitForm";
import { PageHeader } from "@/components/kit";
import { exitFormData } from "@/lib/goods-exit-data";
import { companyToday } from "@/lib/orders";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await getT())("Nueva salida") };
}

export default async function NewExitPage() {
  const t = await getT();
  const [{ clients, skuHints }, today] = await Promise.all([exitFormData(), companyToday()]);
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Nueva salida de mercancía" back={{ href: "/salidas", label: t("Salidas de mercancía") }} />
      <ExitForm action={createExit} clients={clients} skuHints={skuHints} today={today} />
    </div>
  );
}
