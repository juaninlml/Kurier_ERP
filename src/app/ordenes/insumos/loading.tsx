import { ListSkeleton } from "@/components/PageSkeleton";

export default function Loading() {
  return <ListSkeleton back actions={1} stats={5} statCols={4} filters={false} rows={6} cols={5} />;
}
