import { ListSkeleton } from "@/components/PageSkeleton";

export default function Loading() {
  return <ListSkeleton back actions={2} stats={3} filters={false} rows={8} cols={7} />;
}
