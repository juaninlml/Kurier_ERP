import { ListSkeleton } from "@/components/PageSkeleton";

export default function Loading() {
  return <ListSkeleton title="Cotizaciones" subtitle="Propuestas comerciales para prospectos. Al aceptarse, el prospecto se da de alta como cliente con sus tarifas." actions={2} tabs={5} cols={6} />;
}
