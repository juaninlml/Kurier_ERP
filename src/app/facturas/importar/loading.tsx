import { ListSkeleton } from "@/components/PageSkeleton";

export default function Loading() {
  return <ListSkeleton title="Importar del WMS" subtitle="Sube los estados de cobro (PDF) que genera el WMS. Se revisan con las tarifas de cada cliente antes de convertirse en factura." back filters={false} rows={5} cols={5} />;
}
