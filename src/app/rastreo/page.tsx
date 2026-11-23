import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { normalizeTracking } from "@/lib/tracking";
import { TrackingShell, TrackingSearch } from "@/components/TrackingShell";

export const metadata: Metadata = { title: "Rastreo de envío", robots: { index: false, follow: false } };

/** /rastreo: buscador público de guías. Con ?guia=… lleva directo a la guía. */
export default async function TrackingSearchPage({ searchParams }: { searchParams: Promise<{ guia?: string }> }) {
  const { guia } = await searchParams;
  const tracking = guia ? normalizeTracking(guia) : "";
  if (tracking) redirect(`/rastreo/${tracking}`);
  return (
    <TrackingShell>
      <div className="p-6">
        <h1 className="text-lg font-semibold">Rastrea tu envío</h1>
        <p className="mt-1 text-sm text-muted-foreground">Escribe el número de guía que te enviamos (LM-XXXX-XXXX).</p>
        {guia && <p className="mt-3 text-sm text-rose-700">Ese número no tiene la forma de una guía. Revísalo e intenta de nuevo.</p>}
        <TrackingSearch className="mt-5" />
      </div>
    </TrackingShell>
  );
}
