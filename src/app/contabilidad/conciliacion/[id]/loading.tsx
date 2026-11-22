import { ListSkeleton } from "@/components/PageSkeleton";

export default function Loading() {
  return <ListSkeleton back actions={2} stats={4} statCols={4} tabs={4} rows={8} cols={4} />;
}
