import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { normalizeTracking } from "@/lib/tracking";
import { TrackingShell, TrackingSearch } from "@/components/TrackingShell";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Rastreo de envío"), robots: { index: false, follow: false } };
}

/** /rastreo: buscador público de guías. Con ?guia=… lleva directo a la guía. */
export default async function TrackingSearchPage({ searchParams }: { searchParams: Promise<{ guia?: string }> }) {
  const { guia } = await searchParams;
  const t = await getT();
  const tracking = guia ? normalizeTracking(guia) : "";
  if (tracking) redirect(`/rastreo/${tracking}`);
  return (
    <TrackingShell>
      <div className="p-6">
        <h1 className="text-lg font-semibold">{t("Rastrea tu envío")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("Escribe el número de guía que te enviamos (LM-XXXX-XXXX).")}</p>
        {guia && <p className="mt-3 text-sm text-rose-700">{t("Ese número no tiene la forma de una guía. Revísalo e intenta de nuevo.")}</p>}
        <TrackingSearch className="mt-5" />
      </div>
    </TrackingShell>
  );
}
