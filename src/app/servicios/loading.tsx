import { ListSkeleton } from "@/components/PageSkeleton";

export default function Loading() {
  return <ListSkeleton title="Tarifario de servicios" actions={2} cols={5} />;
}
