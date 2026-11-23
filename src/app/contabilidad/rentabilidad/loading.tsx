import { ListSkeleton } from "@/components/PageSkeleton";

export default function Loading() {
  return <ListSkeleton title="Rentabilidad por cliente" back actions={1} stats={4} statCols={4} filters={false} rows={8} cols={9} />;
}
