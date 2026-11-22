import { ListSkeleton } from "@/components/PageSkeleton";

export default function Loading() {
  return <ListSkeleton title="Nómina" subtitle="Empleados, prestaciones de ley (antigüedad, vacaciones, prima vacacional y aguinaldo) y nómina semanal. Sin ISR ni carga patronal." actions={2} stats={4} statCols={4} filters={false} cols={6} />;
}
