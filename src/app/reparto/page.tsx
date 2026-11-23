import { getCurrentUser } from "@/lib/current-user";
import { RepartoApp } from "@/components/reparto/RepartoApp";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reparto" };

/** App de reparto para el celular del repartidor: escanear al cargar y al entregar (firma y foto). */
export default async function RepartoPage() {
  const me = await getCurrentUser();
  return <RepartoApp driver={me.name || me.email} />;
}
