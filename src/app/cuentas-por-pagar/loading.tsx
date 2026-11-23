import { ListSkeleton } from "@/components/PageSkeleton";

export default function Loading() {
  return <ListSkeleton title="Cuentas por pagar" subtitle="Facturas y recibos de proveedores. Cada pago se registra como egreso en contabilidad." actions={2} stats={3} tabs={6} cols={8} />;
}
