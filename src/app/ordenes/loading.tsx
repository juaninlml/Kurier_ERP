import { ListSkeleton } from "@/components/PageSkeleton";

export default function Loading() {
  return <ListSkeleton title="Órdenes diarias" stats={3} filters={false} rows={7} cols={8} />;
}
