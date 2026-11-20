"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  BarChart3,
  Building2,
  ChevronsUpDown,
  Clock,
  HandCoins,
  FileUp,
  PackageOpen,
  Boxes,
  FileText,
  Languages,
  LayoutDashboard,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Sun,
  ReceiptText,
  Settings,
  ShieldCheck,
  Tags,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLang, useT, useTheme } from "./I18nProvider";
import { setLanguage, signOutAction } from "@/app/actions/account";
import { Tr } from "@/components/Tr";

export type SidebarUser = { name: string; email: string; image: string; role: string };

type NavItem = { href: string; label: string; icon: LucideIcon; adminOnly?: boolean };
const NAV: { title: string; items: NavItem[] }[] = [
  { title: "General", items: [{ href: "/", label: "Inicio", icon: LayoutDashboard }] },
  {
    title: "Ventas",
    items: [
      { href: "/cotizaciones", label: "Cotizaciones", icon: FileText },
      { href: "/facturas", label: "Facturas", icon: ReceiptText },
      { href: "/facturas/importar", label: "Importar del WMS", icon: FileUp },
      { href: "/ordenes", label: "Órdenes diarias", icon: PackageOpen },
      { href: "/ordenes/insumos", label: "Insumos de empaque", icon: Boxes },
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
      { href: "/nomina/asistencias", label: "Asistencias", icon: Clock },
      { href: "/contabilidad/reportes", label: "Reportes", icon: BarChart3 },
    ],
  },
  {
    title: "Sistema",
    items: [
      { href: "/usuarios", label: "Usuarios y accesos", icon: ShieldCheck, adminOnly: true },
      { href: "/configuracion", label: "Configuración", icon: Settings },
    ],
  },
];

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => {
    if (href === "/") return pathname === "/";
    if (href === "/facturas") return pathname.startsWith("/facturas") && !pathname.startsWith("/facturas/importar");
    if (href === "/ordenes") return pathname.startsWith("/ordenes") && !pathname.startsWith("/ordenes/insumos");
    if (href === "/nomina") return pathname.startsWith("/nomina") && !pathname.startsWith("/nomina/asistencias");
    if (href === "/contabilidad") return pathname === "/contabilidad" || pathname.startsWith("/contabilidad/movimientos");
    return pathname.startsWith(href);
  };
}

function Brand() {
  const t = useT();
  return (
    <Link href="/" className="flex items-center gap-2.5 px-2">
      <div className="grid size-9 place-items-center rounded-lg bg-sidebar-primary text-base font-bold text-sidebar-primary-foreground shadow-sm">K</div>
      <div className="leading-tight">
        <div className="text-sm font-semibold"><Tr>Kurier ERP</Tr></div>
        <div className="text-[11px] text-sidebar-foreground/60">{t("Fulfillment · CDMX")}</div>
      </div>
    </Link>
  );
}

/** Punto que aparece mientras carga la sección a la que se dio clic (debe ir dentro del <Link>). */
function PendingDot() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={cn(
        "ml-auto size-1.5 rounded-full bg-sidebar-primary transition-opacity duration-(--dur-feedback)",
        pending ? "opacity-100 motion-safe:animate-pulse" : "opacity-0",
      )}
    />
  );
}

function NavLinks({ user, onNavigate }: { user: SidebarUser; onNavigate?: () => void }) {
  const isActiveNow = useIsActive();
  const pathname = usePathname();
  // Marca la opción en cuanto se da clic (sin esperar a que el servidor responda)
  const [clicked, setClicked] = useState<string | null>(null);
  useEffect(() => setClicked(null), [pathname]);
  const isActive = (href: string) => (clicked ? clicked === href : isActiveNow(href));
  const t = useT();
  const admin = user.role === "OWNER" || user.role === "ADMIN";
  return (
    <nav className="flex flex-col gap-5">
      {NAV.map((group) => {
        const items = group.items.filter((i) => !i.adminOnly || admin);
        if (!items.length) return null;
        return (
          <div key={group.title}>
            <div className="mb-1.5 px-3 text-[11px] font-medium tracking-wide text-sidebar-foreground/45 uppercase">{t(group.title)}</div>
            <ul className="flex flex-col gap-0.5">
              {items.map(({ href, label, icon: Icon }) => {
                const active = isActive(href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={(e) => {
                        if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) setClicked(href);
                        onNavigate?.();
                      }}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex h-9 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
                        active
                          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                      )}
                    >
                      <Icon className={cn("size-4 shrink-0", active ? "text-sidebar-primary" : "opacity-70 group-hover:opacity-100")} />
                      {t(label)}
                      <PendingDot />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

export function Avatar({ user, className }: { user: { name: string; email: string; image: string }; className?: string }) {
  const initials = (user.name || user.email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return user.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={user.image} alt="" referrerPolicy="no-referrer" className={cn("size-8 shrink-0 rounded-full object-cover", className)} />
  ) : (
    <span className={cn("grid size-8 shrink-0 place-items-center rounded-full bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground", className)}>{initials}</span>
  );
}

const ROLE_LABEL: Record<string, string> = { OWNER: "Cuenta maestra", ADMIN: "Administrador", USER: "Usuario" };

/** Menú del usuario: perfil, idioma y cerrar sesión. */
function UserMenu({ user }: { user: SidebarUser }) {
  const t = useT();
  const lang = useLang();
  const { theme, setTheme } = useTheme();
  const [pending, start] = useTransition();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors outline-none hover:bg-sidebar-accent/60 focus-visible:ring-2 focus-visible:ring-sidebar-ring">
        <Avatar user={user} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{user.name || user.email}</span>
          <span className="block truncate text-[11px] text-sidebar-foreground/55">{t(ROLE_LABEL[user.role] ?? user.role)}</span>
        </span>
        <ChevronsUpDown className="size-4 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <div className="truncate text-sm font-medium">{user.name || user.email}</div>
          <div className="truncate text-xs text-muted-foreground">{user.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/perfil">
            <UserRound /> {t("Mi perfil")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground">
          <Languages className="size-3.5" /> {t("Idioma")}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={lang} onValueChange={(v) => start(async () => void (await setLanguage(v)))}>
          <DropdownMenuRadioItem value="es" disabled={pending}>
            <Tr>Español</Tr>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="en" disabled={pending}>
            <Tr>English</Tr>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground">
          <Moon className="size-3.5" /> {t("Tema")}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v === "dark" || v === "system" ? v : "light")}>
          <DropdownMenuRadioItem value="light">
            <Sun /> {t("Claro")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon /> {t("Oscuro")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor /> {t("Según el sistema")}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => start(() => signOutAction())}>
          <LogOut /> {t("Cerrar sesión")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Barra lateral fija (escritorio). */
export function AppSidebar({ user }: { user: SidebarUser }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-6 border-r border-sidebar-border bg-sidebar px-3 py-5 text-sidebar-foreground lg:flex">
      <Brand />
      <div className="flex-1 overflow-y-auto">
        <NavLinks user={user} />
      </div>
      <UserMenu user={user} />
    </aside>
  );
}

/** Barra superior con menú deslizable (celular y tablet). */
export function MobileNav({ user }: { user: SidebarUser }) {
  const [open, setOpen] = useState(false);
  const t = useT();
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-sidebar px-4 text-sidebar-foreground lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground" aria-label={t("Abrir menú")}>
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex w-64 flex-col border-sidebar-border bg-sidebar p-4 text-sidebar-foreground">
          <SheetHeader className="p-0 pb-4">
            <SheetTitle className="sr-only">{t("Menú")}</SheetTitle>
            <Brand />
          </SheetHeader>
          <div className="flex-1 overflow-y-auto">
            <NavLinks user={user} onNavigate={() => setOpen(false)} />
          </div>
          <UserMenu user={user} />
        </SheetContent>
      </Sheet>
      <Brand />
    </header>
  );
}
