import { PageSkeleton } from "@/components/PageSkeleton";

export default function Loading() {
  return <PageSkeleton back actions={2} stats={4} statCols={4} />;
}
