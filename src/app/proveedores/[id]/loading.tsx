import { FormSkeleton } from "@/components/PageSkeleton";

export default function Loading() {
  return <FormSkeleton back actions={1} stats={3} panels={2} />;
}
