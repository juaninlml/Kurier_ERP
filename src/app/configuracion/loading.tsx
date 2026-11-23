import { FormSkeleton } from "@/components/PageSkeleton";

export default function Loading() {
  return <FormSkeleton title="Configuración" subtitle="Datos de la empresa y marca que aparecen en todos los PDFs" panels={3} />;
}
