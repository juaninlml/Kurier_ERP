import { ListSkeleton } from "@/components/PageSkeleton";

export default function Loading() {
  return <ListSkeleton title="Proveedores" actions={1} cols={6} />;
}
