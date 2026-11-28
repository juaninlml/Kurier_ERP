"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { ArrowRight, CornerDownLeft, FilePlus2, Loader2, PackagePlus, Search, UserPlus, type LucideIcon } from "lucide-react";
import { globalSearch, type SearchHit } from "@/app/actions/search";
import { canOpen } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { NAV } from "./nav-items";
import { useT } from "./I18nProvider";

const OPEN_EVENT = "kurier:command-palette";

/** Abre el buscador desde cualquier botón. */
export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

type Item = { key: string; group: string; label: string; hint?: string; href: string; icon?: LucideIcon };

/** Acciones directas (aparecen arriba al escribir algo parecido o con el buscador vacío). */
const ACTIONS: { label: string; href: string; icon: LucideIcon; keywords: string }[] = [
  { label: "Nueva factura", href: "/facturas/nueva", icon: FilePlus2, keywords: "crear facturar" },
  { label: "Nueva cotización", href: "/cotizaciones/nueva", icon: FilePlus2, keywords: "crear propuesta" },
  { label: "Capturar órdenes de hoy", href: "/ordenes", icon: PackagePlus, keywords: "oleadas paquetes captura" },
  { label: "Capturar insumos de hoy", href: "/ordenes/insumos", icon: PackagePlus, keywords: "bolsas cajas empaque" },
  { label: "Inventario de insumos", href: "/ordenes/inventario", icon: PackagePlus, keywords: "existencias conteo entrada" },
  { label: "Nuevo envío", href: "/envios/nuevo", icon: PackagePlus, keywords: "guía crear" },
  { label: "Nuevo cliente", href: "/clientes/nuevo", icon: UserPlus, keywords: "alta" },
];

/** Sin acentos ni mayúsculas, para que "nomina" encuentre "Nómina". */
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/**
 * Buscador general (Ctrl+K / ⌘K): secciones, acciones y registros (clientes, folios, guías,
 * proveedores, empleados). Flechas para moverse, Enter para abrir, Esc para cerrar.
 */
export function CommandPalette({ role }: { role: string }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);
  const [pending, start] = useTransition();
  const seq = useRef(0);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setQ("");
      setHits([]);
    }
  }, [open]);

  // Registros del servidor, con una pausa corta para no buscar en cada tecla
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      return;
    }
    const id = ++seq.current;
    const timer = setTimeout(() => {
      start(async () => {
        const r = await globalSearch(term).catch(() => []);
        if (id === seq.current) setHits(r);
      });
    }, 180);
    return () => clearTimeout(timer);
  }, [q]);

  const items = useMemo<Item[]>(() => {
    const term = norm(q.trim());
    const match = (...xs: (string | undefined)[]) => !term || xs.some((x) => x && norm(x).includes(term));
    const pages = NAV.flatMap((g) =>
      g.items
        .filter((i) => canOpen(role, i.href) && match(t(i.label), i.label, i.keywords, t(g.title)))
        .map((i) => ({ key: `p:${i.href}`, group: t("Secciones"), label: t(i.label), hint: t(g.title), href: i.href, icon: i.icon })),
    );
    const actions = ACTIONS.filter((a) => canOpen(role, a.href) && match(t(a.label), a.label, a.keywords)).map((a) => ({
      key: `a:${a.href}`,
      group: t("Acciones"),
      label: t(a.label),
      href: a.href,
      icon: a.icon,
    }));
    const records = hits.map((h) => ({ key: `r:${h.href}`, group: h.group, label: h.label, hint: h.hint, href: h.href }));
    // Con texto: primero los registros encontrados; sin texto: acciones y secciones.
    return term ? [...records, ...actions, ...pages.slice(0, 8)] : [...actions, ...pages];
  }, [q, hits, role, t]);

  useEffect(() => setActive(0), [q, hits]);
  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const go = (it: Item | undefined) => {
    if (!it) return;
    setOpen(false);
    router.push(it.href);
  };

  // Agrupa conservando el orden
  const grouped: { group: string; rows: (Item & { index: number })[] }[] = [];
  items.forEach((it, index) => {
    const g = grouped.at(-1);
    if (g?.group === it.group) g.rows.push({ ...it, index });
    else grouped.push({ group: it.group, rows: [{ ...it, index }] });
  });

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-[12vh] left-1/2 z-50 flex max-h-[70vh] w-[min(640px,calc(100vw-2rem))] -translate-x-1/2 flex-col overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(items.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              go(items[active]);
            }
          }}
        >
          <Dialog.Title className="sr-only">{t("Buscar en el ERP")}</Dialog.Title>
          <div className="flex items-center gap-2 border-b px-4">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("Busca un cliente, folio, guía, proveedor, empleado o sección…")}
              aria-label={t("Buscar en el ERP")}
              role="combobox"
              aria-expanded
              aria-controls="command-results"
              aria-activedescendant={items[active] ? `cmd-${active}` : undefined}
              className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />}
          </div>
          <div ref={list} id="command-results" role="listbox" className="flex-1 overflow-y-auto p-2">
            {items.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">{pending ? t("Buscando…") : t("Sin resultados para «{v0}».", { v0: q.trim() })}</p>
            ) : (
              grouped.map((g) => (
                <div key={g.group} role="group" aria-label={g.group} className="mb-1">
                  <div className="px-3 pt-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{g.group}</div>
                  {g.rows.map((it) => {
                    const Icon = it.icon ?? ArrowRight;
                    const on = it.index === active;
                    return (
                      <div
                        key={it.key}
                        id={`cmd-${it.index}`}
                        data-index={it.index}
                        role="option"
                        aria-selected={on}
                        onMouseMove={() => setActive(it.index)}
                        onClick={() => go(it)}
                        className={cn("flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm", on && "bg-accent text-accent-foreground")}
                      >
                        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="min-w-0 flex-1 truncate">
                          <span className="font-medium">{it.label}</span>
                          {it.hint && <span className="ml-2 text-xs text-muted-foreground">{it.hint}</span>}
                        </span>
                        {on && <CornerDownLeft className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
          <div className="flex items-center gap-4 border-t px-4 py-2 text-[11px] text-muted-foreground">
            <span>
              <kbd className="font-sans">↑ ↓</kbd> {t("moverse")}
            </span>
            <span>
              <kbd className="font-sans">Enter</kbd> {t("abrir")}
            </span>
            <span>
              <kbd className="font-sans">Esc</kbd> {t("cerrar")}
            </span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
