import { ListSkeleton } from "@/components/PageSkeleton";

export default function Loading() {
  return <ListSkeleton title="Facturas" subtitle="Formato interno de facturación y estado de cuenta (no sustituye al CFDI)." actions={2} stats={3} tabs={6} cols={8} />;
}
