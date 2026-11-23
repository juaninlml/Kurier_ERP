import { ListSkeleton } from "@/components/PageSkeleton";

export default function Loading() {
  return <ListSkeleton title="Conciliación bancaria" back stats={2} statCols={2} filters={false} rows={5} cols={6} />;
}
