import { Skeleton } from "@/components/ui/skeleton";

/**
 * Esqueleto que se muestra al instante mientras el servidor arma la página.
 * Cada sección tiene su propio loading.tsx con este componente: así el clic responde de inmediato
 * y Next.js puede precargar el esqueleto de cada liga del menú.
 */
export function PageSkeleton() {
  return (
    <div className="space-y-6 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200" aria-busy="true" aria-label="Cargando">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}
