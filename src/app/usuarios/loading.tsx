import { ListSkeleton } from "@/components/PageSkeleton";

export default function Loading() {
  return <ListSkeleton title="Usuarios y accesos" subtitle="Invita personas con un link: escanean un QR con su app autenticadora y entran con su correo y el código." filters={false} rows={5} cols={5} />;
}
