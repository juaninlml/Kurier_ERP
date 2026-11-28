"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { KidoBrand } from "./KidoLogo";
import { SessionCurtain } from "./SessionCurtain";
import { useEffect, useState, useTransition } from "react";
import { ChevronDown, ChevronsUpDown, Languages, LogOut, Menu, Monitor, Moon, Search, Sparkles, Sun, UserRound } from "lucide-react";
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
import { LANGS, LANG_NAMES } from "@/lib/i18n/core";
import { DOOR_COVERED_MS, stampDoor, type Door } from "@/lib/session-ui";
import { canOpen, ROLE_LABEL } from "@/lib/permissions";
import { NAV, activeHref, type NavBadge } from "./nav-items";
import { CommandPalette, openCommandPalette } from "./CommandPalette";

export type SidebarUser = { name: string; email: string; image: string; role: string };

export type NavBadges = Record<string, NavBadge>;

const COLLAPSED_KEY = "kurier_nav_collapsed";

/** Grupos plegados (se recuerdan en este navegador). */
function useCollapsed() {
  const [collapsed, setCollapsed] = useState<string[]>([]);
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? "[]");
      if (Array.isArray(v)) setCollapsed(v.filter((x) => typeof x === "string"));
    } catch {
      /* sin almacenamiento: todo abierto */
    }
  }, []);
  const toggle = (id: string) =>
    setCollapsed((c) => {
      const next = c.includes(id) ? c.filter((x) => x !== id) : [...c, id];
      try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
      } catch {
        /* ignora */
      }
      return next;
    });
  return { collapsed, toggle };
}

function Brand() {
  const t = useT();
  return (
    <Link href="/" className="block px-2" aria-label={t("Kurier ERP")}>
      <KidoBrand
        sub={
          <>
            <span className="font-semibold tracking-[0.14em] text-sidebar-foreground/80">ERP</span> · {t("Fulfillment · CDMX")}
          </>
        }
      />
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

function NavLinks({ user, badges = {}, onNavigate }: { user: SidebarUser; badges?: NavBadges; onNavigate?: () => void }) {
  const pathname = usePathname();
  // Marca la opción en cuanto se da clic (sin esperar a que el servidor responda)
  const [clicked, setClicked] = useState<string | null>(null);
  useEffect(() => setClicked(null), [pathname]);
  const current = clicked ?? activeHref(pathname);
  const { collapsed, toggle } = useCollapsed();
  const t = useT();
  return (
    <nav className="flex flex-col gap-3">
      {NAV.map((group) => {
        // Solo las secciones que el rol puede consultar (ver src/lib/permissions.ts)
        const items = group.items.filter((i) => canOpen(user.role, i.href));
        if (!items.length) return null;
        const hasActive = items.some((i) => i.href === current);
        // El grupo de la sección abierta nunca se pliega; plegado, muestra la suma de sus pendientes.
        const open = group.id === "general" || hasActive || !collapsed.includes(group.id);
        const hidden = items.reduce((a, i) => a + (badges[i.href]?.n ?? 0), 0);
        const hiddenAlert = items.some((i) => badges[i.href]?.tone === "alert");
        return (
          <div key={group.id}>
            {group.id !== "general" && (
              <button
                type="button"
                onClick={() => !hasActive && toggle(group.id)}
                aria-expanded={open}
                className="mb-1 flex w-full items-center gap-1.5 rounded-md px-3 py-1 text-left text-[11px] font-medium tracking-wide text-sidebar-foreground/45 uppercase transition-colors outline-none hover:text-sidebar-foreground/75 focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              >
                <span className="flex-1">{t(group.title)}</span>
                {!open && hidden > 0 && <Count n={hidden} tone={hiddenAlert ? "alert" : "info"} />}
                {!hasActive && <ChevronDown aria-hidden className={cn("size-3.5 transition-transform duration-(--dur-state)", !open && "-rotate-90")} />}
              </button>
            )}
            {open && (
              <ul className="flex flex-col gap-0.5">
                {items.map(({ href, label, icon: Icon }) => {
                  const active = current === href;
                  const badge = badges[href];
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        onClick={(e) => {
                          if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) setClicked(href);
                          onNavigate?.();
                        }}
                        aria-current={active ? "page" : undefined}
                        title={badge?.title}
                        className={cn(
                          "group flex h-9 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
                          active
                            ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                        )}
                      >
                        <Icon className={cn("size-4 shrink-0", active ? "text-sidebar-primary" : "opacity-70 group-hover:opacity-100")} />
                        <span className="min-w-0 flex-1 truncate">{t(label)}</span>
                        {badge ? (
                          <>
                            <Count n={badge.n} tone={badge.tone} />
                            <span className="sr-only">{badge.title}</span>
                          </>
                        ) : (
                          <PendingDot />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}

/** Contador de pendientes: rojo si requiere atención, neutro si es informativo. */
function Count({ n, tone }: { n: number; tone: "alert" | "info" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10.5px] leading-none font-semibold tabular-nums",
        tone === "alert" ? "bg-rose-600 text-white" : "bg-sidebar-primary/15 text-sidebar-primary",
      )}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

/** Botón que abre el buscador (Ctrl+K / ⌘K). */
function SearchButton() {
  const t = useT();
  const [mac, setMac] = useState(false);
  useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform)), []);
  return (
    <button
      type="button"
      onClick={openCommandPalette}
      className="flex h-9 w-full items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-3 text-left text-sm text-sidebar-foreground/60 transition-colors outline-none hover:bg-sidebar-accent/70 hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
    >
      <Search className="size-4 shrink-0" aria-hidden />
      <span className="flex-1 truncate">{t("Buscar…")}</span>
      <kbd className="rounded border border-sidebar-border px-1.5 font-sans text-[10.5px] text-sidebar-foreground/55">{mac ? "⌘K" : "Ctrl K"}</kbd>
    </button>
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


/** Menú del usuario: perfil, idioma y cerrar sesión. */
function UserMenu({ user }: { user: SidebarUser }) {
  const t = useT();
  const lang = useLang();
  const { theme, setTheme } = useTheme();
  const [pending, start] = useTransition();
  const [door, setDoor] = useState<Door | null>(null);
  return (
    <>
    {door && <SessionCurtain phase="cover" label={t("Cerrando sesión…")} door={door} portal />}
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
        <DropdownMenuItem asChild>
          <Link href="/novedades">
            <Sparkles /> {t("Novedades")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground">
          <Languages className="size-3.5" /> {t("Idioma")}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={lang} onValueChange={(v) => start(async () => void (await setLanguage(v)))}>
          {LANGS.map((v) => (
            <DropdownMenuRadioItem key={v} value={v} disabled={pending} lang={v}>
              {LANG_NAMES[v].name}
            </DropdownMenuRadioItem>
          ))}
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
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => {
            // Sube la cortina desde el símbolo de la barra; el login la continúa y la deja sobre su logo.
            setDoor(stampDoor("out"));
            // Se cierra la sesión cuando la cortina ya cubre: nunca se asoma el login por arriba del borde.
            const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            setTimeout(() => start(() => signOutAction()), reduce ? 200 : DOOR_COVERED_MS);
          }}
        >
          <LogOut /> {t("Cerrar sesión")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    </>
  );
}

/** Barra lateral fija (escritorio). */
export function AppSidebar({ user, badges }: { user: SidebarUser; badges?: NavBadges }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-4 border-r border-sidebar-border bg-sidebar px-3 py-5 text-sidebar-foreground lg:flex">
      <Brand />
      <SearchButton />
      <div className="-mx-1 flex-1 overflow-y-auto px-1">
        <NavLinks user={user} badges={badges} />
      </div>
      <UserMenu user={user} />
    </aside>
  );
}

/** Barra superior con menú deslizable (celular y tablet). */
export function MobileNav({ user, badges }: { user: SidebarUser; badges?: NavBadges }) {
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
        <SheetContent side="left" className="flex w-72 flex-col border-sidebar-border bg-sidebar p-4 text-sidebar-foreground">
          <SheetHeader className="p-0 pb-4">
            <SheetTitle className="sr-only">{t("Menú")}</SheetTitle>
            <Brand />
          </SheetHeader>
          <div className="pb-3">
            <SearchButton />
          </div>
          <div className="flex-1 overflow-y-auto">
            <NavLinks user={user} badges={badges} onNavigate={() => setOpen(false)} />
          </div>
          <UserMenu user={user} />
        </SheetContent>
      </Sheet>
      <Brand />
      <Button
        variant="ghost"
        size="icon"
        className="ml-auto text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
        aria-label={t("Buscar")}
        onClick={openCommandPalette}
      >
        <Search />
      </Button>
    </header>
  );
}
