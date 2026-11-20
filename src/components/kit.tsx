import Link from "next/link";
import { ArrowRight, ChevronLeft, Inbox, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Tr } from "./Tr";

/** Los textos fijos que reciben estos componentes se traducen solos (los datos, como nombres, no tienen traducción y quedan igual). */
const tx = (v: React.ReactNode) => (typeof v === "string" ? <Tr>{v}</Tr> : v);

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6 sm:mb-8">
      {back && (
        <Link
          href={back.href}
          className="mb-3 inline-flex items-center gap-1 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          {tx(back.label)}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-[1.75rem]">{tx(title)}</h1>
          {subtitle && <div className="mt-1.5 text-sm text-pretty text-muted-foreground">{tx(subtitle)}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export { StatusBadge } from "./StatusBadge";

export function Stat({
  label,
  value,
  hint,
  tone,
  icon: Icon,
  href,
  delta,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "pos" | "neg";
  icon?: LucideIcon;
  href?: string;
  /** Variación contra el periodo anterior (ver <Delta/>). */
  delta?: React.ReactNode;
}) {
  const body = (
    <Card
      className={cn(
        "gap-0 py-5 shadow-xs",
        // El enlace no se mueve (no se escapa del cursor); se eleva la tarjeta dentro de él.
        href && "lift-surface group-hover/stat:-translate-y-0.5 group-hover/stat:shadow-md group-focus-visible/stat:shadow-md group-active/stat:translate-y-0",
      )}
    >
      <CardContent className="px-5">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-medium text-muted-foreground">{tx(label)}</div>
          {Icon && (
            <div
              className={cn(
                "grid size-8 place-items-center rounded-lg bg-muted text-muted-foreground",
                href && "transition-colors duration-(--dur-state) ease-(--ease-out) group-hover/stat:bg-primary/10 group-hover/stat:text-primary",
              )}
            >
              <Icon className="size-4" />
            </div>
          )}
        </div>
        <div
          className={cn(
            "mt-2 text-2xl font-semibold tracking-tight",
            tone === "pos" && "text-emerald-700",
            tone === "neg" && "text-rose-700",
          )}
        >
          {value}
        </div>
        {(hint || delta || href) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {delta}
            {hint && <span>{tx(hint)}</span>}
            {href && (
              <ArrowRight
                aria-hidden
                className="ml-auto size-3.5 -translate-x-1 opacity-0 transition-[opacity,translate] duration-(--dur-state) ease-(--ease-out) group-hover/stat:translate-x-0 group-hover/stat:opacity-100 group-focus-visible/stat:translate-x-0 group-focus-visible/stat:opacity-100 motion-reduce:translate-x-0"
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
  return href ? (
    <Link href={href} className="group/stat rounded-xl focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none">
      {body}
    </Link>
  ) : (
    body
  );
}

export function Empty({ children, icon: Icon = Inbox, action }: { children: React.ReactNode; icon?: LucideIcon; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-14 text-center">
      <div className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </div>
      <div className="max-w-sm text-sm text-muted-foreground">{tx(children)}</div>
      {action}
    </div>
  );
}

export function Field({ label, children, className, hint }: { label: string; children: React.ReactNode; className?: string; hint?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="label">{tx(label)}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{tx(hint)}</span>}
    </label>
  );
}

/** Tarjeta con encabezado (título, descripción y acción opcional). */
export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("card overflow-hidden", className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3.5">
          <div className="min-w-0">
            {title && <h2 className="text-[0.95rem] font-semibold">{tx(title)}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{tx(description)}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
