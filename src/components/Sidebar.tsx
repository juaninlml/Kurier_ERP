"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  Building2,
  HandCoins,
  FileUp,
  FileText,
  LayoutDashboard,
  Menu,
  ReceiptText,
  Settings,
  Tags,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type NavItem = { href: string; label: string; icon: LucideIcon };
const NAV: { title: string; items: NavItem[] }[] = [
  { title: "General", items: [{ href: "/", label: "Inicio", icon: LayoutDashboard }] },
  {
    title: "Ventas",
    items: [
      { href: "/cotizaciones", label: "Cotizaciones", icon: FileText },
      { href: "/facturas", label: "Facturas", icon: ReceiptText },
      { href: "/facturas/importar", label: "Importar del WMS", icon: FileUp },
      { href: "/clientes", label: "Clientes", icon: Users },
      { href: "/servicios", label: "Tarifario", icon: Tags },
    ],
  },
  {
    title: "Finanzas",
    items: [
      { href: "/contabilidad", label: "Contabilidad", icon: Wallet },
      { href: "/contabilidad/gastos-fijos", label: "Gastos fijos", icon: Building2 },
      { href: "/nomina", label: "Nómina", icon: HandCoins },
      { href: "/contabilidad/reportes", label: "Reportes", icon: BarChart3 },
    ],
  },
  { title: "Sistema", items: [{ href: "/configuracion", label: "Configuración", icon: Settings }] },
];

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => {
    if (href === "/") return pathname === "/";
    if (href === "/facturas") return pathname.startsWith("/facturas") && !pathname.startsWith("/facturas/importar");
    if (href === "/contabilidad") return pathname === "/contabilidad" || pathname.startsWith("/contabilidad/movimientos");
    return pathname.startsWith(href);
  };
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-2">
      <div className="grid size-9 place-items-center rounded-lg bg-sidebar-primary text-base font-bold text-sidebar-primary-foreground shadow-sm">K</div>
      <div className="leading-tight">
        <div className="text-sm font-semibold">Kurier ERP</div>
        <div className="text-[11px] text-sidebar-foreground/60">Fulfillment · CDMX</div>
      </div>
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const isActive = useIsActive();
  return (
    <nav className="flex flex-col gap-5">
      {NAV.map((group) => (
        <div key={group.title}>
          <div className="mb-1.5 px-3 text-[11px] font-medium tracking-wide text-sidebar-foreground/45 uppercase">{group.title}</div>
          <ul className="flex flex-col gap-0.5">
            {group.items.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex h-9 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
                      active
                        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <Icon className={cn("size-4 shrink-0", active ? "text-sidebar-primary" : "opacity-70 group-hover:opacity-100")} />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Barra lateral fija (escritorio). */
export function AppSidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-6 border-r border-sidebar-border bg-sidebar px-3 py-5 text-sidebar-foreground lg:flex">
      <Brand />
      <div className="flex-1 overflow-y-auto">
        <NavLinks />
      </div>
      <p className="px-3 text-[11px] text-sidebar-foreground/40">Documentos informativos · no CFDI</p>
    </aside>
  );
}

/** Barra superior con menú deslizable (celular y tablet). */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-sidebar px-4 text-sidebar-foreground lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground" aria-label="Abrir menú">
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 border-sidebar-border bg-sidebar p-4 text-sidebar-foreground">
          <SheetHeader className="p-0 pb-4">
            <SheetTitle className="sr-only">Menú</SheetTitle>
            <Brand />
          </SheetHeader>
          <NavLinks onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <Brand />
    </header>
  );
}
