import { ListSkeleton } from "@/components/PageSkeleton";

export default function Loading() {
  return <ListSkeleton title="Bitácora" subtitle="Quién creó, modificó, canceló o eliminó cada registro, y cuándo." actions={1} filters={false} rows={12} cols={5} />;
}
