import {
  BarChart3,
  BellRing,
  Building2,
  CalendarRange,
  Clock,
  FileText,
  FileUp,
  HandCoins,
  History,
  Landmark,
  LayoutDashboard,
  PackageCheck,
  PackageMinus,
  PackageOpen,
  PieChart,
  Receipt,
  ReceiptText,
  ScanLine,
  Settings,
  ShieldCheck,
  Tags,
  Target,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/*
 * Menú del ERP, agrupado por tarea (no por departamento). Lo usan la barra lateral y el
 * buscador (Ctrl+K). Insumos e Inventario viven como pestañas dentro de Órdenes diarias.
 */

export type NavItem = { href: string; label: string; icon: LucideIcon; /** Palabras extra para el buscador. */ keywords?: string };
export type NavGroup = { id: string; title: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  { id: "general", title: "General", items: [{ href: "/", label: "Inicio", icon: LayoutDashboard, keywords: "dashboard pendientes" }] },
  {
    id: "operacion",
    title: "Operación",
    items: [
      { href: "/ordenes", label: "Órdenes diarias", icon: PackageOpen, keywords: "oleadas paquetes insumos inventario bolsas cajas" },
      { href: "/envios", label: "Envíos última milla", icon: PackageCheck, keywords: "guías guia rastreo" },
      { href: "/salidas", label: "Salidas de mercancía", icon: PackageMinus, keywords: "sku cajas" },
      { href: "/reparto", label: "Reparto", icon: ScanLine, keywords: "ruta repartidor escáner" },
    ],
  },
  {
    id: "ventas",
    title: "Ventas",
    items: [
      { href: "/cotizaciones", label: "Cotizaciones", icon: FileText, keywords: "propuestas prospectos" },
      { href: "/clientes", label: "Clientes", icon: Users },
      { href: "/servicios", label: "Tarifario", icon: Tags, keywords: "precios servicios" },
    ],
  },
  {
    id: "facturacion",
    title: "Facturación y cobro",
    items: [
      { href: "/facturas", label: "Facturas", icon: ReceiptText },
      { href: "/facturas/semanal", label: "Facturación semanal", icon: CalendarRange, keywords: "servicio logístico semana" },
      { href: "/facturas/importar", label: "Importar del WMS", icon: FileUp, keywords: "estado de cobro" },
      { href: "/cobranza", label: "Cobranza", icon: BellRing, keywords: "vencidas recordatorios promesas" },
    ],
  },
  {
    id: "finanzas",
    title: "Finanzas",
    items: [
      { href: "/contabilidad", label: "Contabilidad", icon: Wallet, keywords: "movimientos ingresos egresos" },
      { href: "/contabilidad/conciliacion", label: "Conciliación bancaria", icon: Landmark, keywords: "banco estado de cuenta" },
      { href: "/cuentas-por-pagar", label: "Cuentas por pagar", icon: Receipt, keywords: "pagos proveedores" },
      { href: "/proveedores", label: "Proveedores", icon: Truck },
      { href: "/contabilidad/presupuesto", label: "Presupuesto", icon: Target },
      { href: "/contabilidad/gastos-fijos", label: "Gastos fijos", icon: Building2, keywords: "punto de equilibrio" },
      { href: "/contabilidad/reportes", label: "Reportes", icon: BarChart3, keywords: "estado de resultados" },
      { href: "/contabilidad/rentabilidad", label: "Rentabilidad por cliente", icon: PieChart, keywords: "margen" },
    ],
  },
  {
    id: "personal",
    title: "Personal",
    items: [
      { href: "/nomina", label: "Nómina", icon: HandCoins, keywords: "empleados recibos aguinaldo" },
      { href: "/nomina/asistencias", label: "Asistencias", icon: Clock, keywords: "checadas kiosco retardos" },
    ],
  },
  {
    id: "sistema",
    title: "Sistema",
    items: [
      { href: "/usuarios", label: "Usuarios y accesos", icon: ShieldCheck },
      { href: "/bitacora", label: "Bitácora", icon: History, keywords: "auditoría cambios" },
      { href: "/configuracion", label: "Configuración", icon: Settings, keywords: "marcas logo drive empresa" },
    ],
  },
];

/** Opción del menú que corresponde a la ruta actual (la más específica gana). */
export function activeHref(pathname: string) {
  if (pathname === "/") return "/";
  let best = "";
  for (const g of NAV) for (const i of g.items) if (i.href !== "/" && (pathname === i.href || pathname.startsWith(`${i.href}/`)) && i.href.length > best.length) best = i.href;
  return best || null;
}

/** Contador junto a una opción del menú (lo calcula el servidor). */
export type NavBadge = { n: number; tone: "alert" | "info"; title: string };
