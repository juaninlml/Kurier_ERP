import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/kit";
import { getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

/**
 * Esqueletos que se muestran al instante mientras el servidor arma la página.
 * Cada sección tiene su propio loading.tsx con la MISMA forma que su página (encabezado real, número
 * de indicadores, barra de filtros y tabla), para que al llegar los datos nada cambie de lugar ni de alto.
 * Las medidas copian las de <PageHeader>, <Stat>, <FilterBar>, <Panel> y `.table`.
 */

type Props = {
  /** Título real de la página (ya se conoce antes de los datos). Sin título se pinta una barra. */
  title?: string;
  /** Subtítulo fijo; si depende de datos, se pinta una barra. */
  subtitle?: string;
  /** Liga "‹ Regresar" arriba del título. */
  back?: boolean;
  /** Botones a la derecha del encabezado. */
  actions?: number;
  /** Tarjetas de indicadores. */
  stats?: number;
  /** Columnas de la rejilla de indicadores (como en la página). */
  statCols?: 2 | 3 | 4 | 5;
};

function Header({ title, subtitle, back, actions = 0 }: Props) {
  const actionsNode = actions ? (
    <>
      {Array.from({ length: actions }).map((_, i) => (
        <Skeleton key={i} className={cn("h-9 rounded-lg", i === actions - 1 ? "w-36" : "w-32")} />
      ))}
    </>
  ) : undefined;
  if (title)
    return (
      <>
        {back && <Skeleton className="mb-3 h-5 w-24" />}
        <PageHeader title={title} subtitle={subtitle ?? <Skeleton className="h-4 w-72 max-w-full" />} actions={actionsNode} />
      </>
    );
  return (
    <div className="mb-6 sm:mb-8">
      {back && <Skeleton className="mb-3 h-5 w-24" />}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 space-y-2.5">
          <Skeleton className="h-8 w-60 max-w-full" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        {actionsNode && <div className="flex flex-wrap items-center gap-2">{actionsNode}</div>}
      </div>
    </div>
  );
}

const COLS = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-2 xl:grid-cols-4", 5: "sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5" } as const;

/** Igual que <Stat>: py-5, renglón de etiqueta con ícono de 32px, cifra de 32px y pista de 16px. */
export function StatsSkeleton({ count, cols = 3 }: { count: number; cols?: 2 | 3 | 4 | 5 }) {
  return (
    <div className={cn("mb-6 grid gap-4", COLS[cols])}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card py-5 shadow-xs">
          <div className="px-5">
            <div className="flex h-8 items-center justify-between gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="size-8 rounded-lg" />
            </div>
            <Skeleton className="mt-2 h-8 w-36" />
            <Skeleton className="mt-1.5 h-4 w-28" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Igual que la tarjeta de lista: <FilterBar> (pestañas + búsqueda), encabezado de tabla y renglones. */
export function TableSkeleton({ rows = 8, filters = true, tabs = 0, cols = 6 }: { rows?: number; filters?: boolean; tabs?: number; cols?: number }) {
  const widths = ["w-20", "w-40", "w-24", "w-24", "w-20", "w-24", "w-16", "w-20"];
  return (
    <div className="card overflow-hidden">
      {filters && (
        <div className="flex flex-col gap-3 border-b px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-1">
            {Array.from({ length: tabs }).map((_, i) => (
              <Skeleton key={i} className={cn("h-8 rounded-lg", i === 0 ? "w-16" : "w-24")} />
            ))}
          </div>
          <Skeleton className="h-9 w-full rounded-lg md:w-72" />
        </div>
      )}
      <div className="flex h-10 items-center gap-6 border-b bg-muted/50 px-4">
        {Array.from({ length: cols }).map((_, j) => (
          <Skeleton key={j} className={cn("h-3", widths[j % widths.length], j >= cols - 2 && "ml-auto")} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex h-[41px] items-center gap-6 border-b px-4 last:border-b-0">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className={cn("h-4", widths[(i + j) % widths.length], j >= cols - 2 && "ml-auto")} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Igual que <Panel>: encabezado con borde y cuerpo con campos. */
export function PanelSkeleton({ fields = 4, className }: { fields?: number; className?: string }) {
  return (
    <section className={cn("card overflow-hidden", className)}>
      <header className="border-b px-5 py-3.5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-1.5 h-3 w-64 max-w-full" />
      </header>
      <div className="grid gap-4 p-5 sm:grid-cols-2">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i}>
            <Skeleton className="mb-1.5 h-3.5 w-24" />
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </section>
  );
}

async function Frame({ children }: { children: React.ReactNode }) {
  const t = await getT();
  return (
    <div className="skeleton-in" aria-busy="true" aria-label={t("Cargando")}>
      {children}
    </div>
  );
}

/** Lista: encabezado, indicadores opcionales y la tarjeta con filtros y tabla. */
export async function ListSkeleton({ tabs = 0, filters = true, rows = 8, cols = 6, ...head }: Props & { tabs?: number; filters?: boolean; rows?: number; cols?: number }) {
  return (
    <Frame>
      <Header {...head} />
      {head.stats ? <StatsSkeleton count={head.stats} cols={head.statCols} /> : null}
      <TableSkeleton tabs={tabs} filters={filters} rows={rows} cols={cols} />
    </Frame>
  );
}

/** Formulario o detalle: encabezado (con "Regresar") y paneles con campos. */
export async function FormSkeleton({ panels = 2, ...head }: Props & { panels?: number }) {
  return (
    <Frame>
      <Header {...head} />
      {head.stats ? <StatsSkeleton count={head.stats} cols={head.statCols} /> : null}
      <div className="space-y-6">
        {Array.from({ length: panels }).map((_, i) => (
          <PanelSkeleton key={i} fields={i === 0 ? 6 : 4} />
        ))}
      </div>
    </Frame>
  );
}

/** Tablero (Inicio): indicadores y una gráfica. */
export async function PageSkeleton(head: Props = {}) {
  return (
    <Frame>
      <Header {...head} />
      <StatsSkeleton count={head.stats ?? 4} cols={head.statCols ?? 4} />
      <Skeleton className="h-80 rounded-xl" />
    </Frame>
  );
}
