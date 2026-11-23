import { ListSkeleton } from "@/components/PageSkeleton";

export default function Loading() {
  return <ListSkeleton back actions={1} filters={false} rows={8} cols={5} />;
}
