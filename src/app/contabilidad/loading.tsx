import { ListSkeleton } from "@/components/PageSkeleton";

export default function Loading() {
  return <ListSkeleton title="Contabilidad" actions={4} stats={3} filters={false} rows={10} cols={6} />;
}
