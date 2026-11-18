"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Inicio", icon: "◧" },
  { href: "/cotizaciones", label: "Cotizaciones", icon: "✎" },
  { href: "/facturas", label: "Facturas", icon: "▤" },
  { href: "/contabilidad", label: "Contabilidad", icon: "⇅" },
  { href: "/contabilidad/reportes", label: "Reportes", icon: "▥" },
  { href: "/clientes", label: "Clientes", icon: "☺" },
  { href: "/servicios", label: "Tarifario", icon: "▦" },
  { href: "/configuracion", label: "Configuración", icon: "⚙" },
];

export function Sidebar() {
  const pathname = usePathname();
  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href === "/contabilidad") return pathname === "/contabilidad" || pathname.startsWith("/contabilidad/movimientos");
    return pathname.startsWith(href);
  };
  return (
    <aside className="bg-brand text-white md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0">
      <div className="flex items-center gap-2 px-5 py-4 md:py-6">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-lg font-bold">K</div>
        <div>
          <div className="text-sm font-semibold leading-tight">Kurier ERP</div>
          <div className="text-[11px] text-white/60">Fulfillment</div>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`flex shrink-0 items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
              isActive(n.href) ? "bg-white/15 font-medium text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
            }`}
          >
            <span className="w-4 text-center opacity-80">{n.icon}</span>
            {n.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
