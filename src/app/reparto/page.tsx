import { getCurrentUser } from "@/lib/current-user";
import { getMyLoad } from "@/app/actions/reparto";
import { RepartoApp } from "@/components/reparto/RepartoApp";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await getT())("Reparto") };
}

/**
 * App de reparto para el celular del repartidor: almacenamiento → paquetes → cerrar carga → entregar.
 * La carga en curso viene del servidor: si ya la cerró, la app abre directo (y solo) en Entrega.
 */
export default async function RepartoPage() {
  const me = await getCurrentUser();
  const load = await getMyLoad();
  return <RepartoApp driver={me.name || me.email} initialLoad={load} />;
}
