import { ListSkeleton } from "@/components/PageSkeleton";

export default function Loading() {
  return <ListSkeleton title="Gastos fijos y punto de equilibrio" subtitle="Registra los gastos recurrentes de la operación y calcula cuántas órdenes diarias se necesitan para cubrirlos." back stats={3} filters={false} rows={6} cols={4} />;
}
