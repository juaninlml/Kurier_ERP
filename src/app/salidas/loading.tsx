import { ListSkeleton } from "@/components/PageSkeleton";

export default function Loading() {
  return <ListSkeleton title="Salidas de mercancía" actions={2} cols={8} />;
}
