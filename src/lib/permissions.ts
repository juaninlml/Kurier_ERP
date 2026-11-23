/**
 * Permisos por rol y módulo. Código puro (sin base de datos): lo usan el proxy (páginas y PDFs),
 * las server actions (`safe`), la barra lateral y la exportación.
 *
 *   OWNER / ADMIN  todo.
 *   USER           todo lo operativo; sin Usuarios, Configuración ni Bitácora.
 *   CONTADOR       consulta finanzas (facturas, contabilidad, proveedores, cuentas por pagar, nómina,
 *                  bitácora) y puede conciliar el banco; no modifica nada más.
 *   VENTAS         cotizaciones, clientes y órdenes; consulta tarifario y facturas.
 */

export const ROLES = ["OWNER", "ADMIN", "USER", "CONTADOR", "VENTAS"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<string, string> = {
  OWNER: "Cuenta maestra",
  ADMIN: "Administrador",
  USER: "Usuario",
  CONTADOR: "Contador (consulta)",
  VENTAS: "Ventas",
};
export const ROLE_HINT: Record<string, string> = {
  ADMIN: "Todo, incluidos usuarios y configuración.",
  USER: "Toda la operación; sin usuarios, configuración ni bitácora.",
  CONTADOR: "Consulta finanzas, reportes y bitácora; puede conciliar el banco y exportar.",
  VENTAS: "Cotizaciones, clientes y órdenes; consulta tarifario y facturas.",
};

export type ModuleId =
  | "inicio"
  | "cotizaciones"
  | "facturas"
  | "ordenes"
  | "envios"
  | "clientes"
  | "tarifario"
  | "contabilidad"
  | "conciliacion"
  | "proveedores"
  | "cxp"
  | "nomina"
  | "usuarios"
  | "configuracion"
  | "bitacora"
  | "perfil"
  | "general";

/** Prefijo de ruta → módulo. Gana el prefijo más largo (p. ej. conciliación dentro de contabilidad). */
const ROUTES: [string, ModuleId][] = [
  ["/cotizaciones", "cotizaciones"],
  ["/facturas", "facturas"],
  ["/ordenes", "ordenes"],
  ["/envios", "envios"],
  ["/clientes", "clientes"],
  ["/servicios", "tarifario"],
  ["/contabilidad/conciliacion", "conciliacion"],
  ["/contabilidad", "contabilidad"],
  ["/proveedores", "proveedores"],
  ["/cuentas-por-pagar", "cxp"],
  ["/nomina", "nomina"],
  ["/usuarios", "usuarios"],
  ["/configuracion", "configuracion"],
  ["/bitacora", "bitacora"],
  ["/perfil", "perfil"],
  // PDFs y exportación
  ["/api/pdf/cotizacion", "cotizaciones"],
  ["/api/pdf/factura", "facturas"],
  ["/api/pdf/estado-cuenta", "clientes"],
  ["/api/pdf/ordenes", "ordenes"],
  ["/api/pdf/guia", "envios"],
  ["/api/pdf/tarifario", "tarifario"],
  ["/api/pdf/reporte", "contabilidad"],
  ["/api/pdf/nomina", "nomina"],
  ["/api/pdf/incidencia", "nomina"],
];

type Access = "write" | "read";
const ALL: ModuleId[] = [
  "inicio", "cotizaciones", "facturas", "ordenes", "envios", "clientes", "tarifario", "contabilidad", "conciliacion",
  "proveedores", "cxp", "nomina", "usuarios", "configuracion", "bitacora", "perfil", "general",
];
const every = (a: Access, except: ModuleId[] = []) =>
  Object.fromEntries(ALL.filter((m) => !except.includes(m)).map((m) => [m, a])) as Partial<Record<ModuleId, Access>>;

const ACCESS: Record<Role, Partial<Record<ModuleId, Access>>> = {
  OWNER: every("write"),
  ADMIN: every("write"),
  USER: every("write", ["usuarios", "configuracion", "bitacora"]),
  CONTADOR: {
    inicio: "read",
    facturas: "read",
    clientes: "read",
    tarifario: "read",
    contabilidad: "read",
    conciliacion: "write",
    proveedores: "read",
    cxp: "read",
    nomina: "read",
    bitacora: "read",
    perfil: "write",
  },
  VENTAS: {
    inicio: "read",
    cotizaciones: "write",
    clientes: "write",
    ordenes: "write",
    envios: "write",
    tarifario: "read",
    facturas: "read",
    perfil: "write",
  },
};

const isRole = (r: string): r is Role => (ROLES as readonly string[]).includes(r);

export function moduleOf(pathname: string): ModuleId | null {
  if (pathname === "/") return "inicio";
  let best: [string, ModuleId] | null = null;
  for (const r of ROUTES) if ((pathname === r[0] || pathname.startsWith(`${r[0]}/`)) && (!best || r[0].length > best[0].length)) best = r;
  return best ? best[1] : null;
}

export function canRead(role: string, module: ModuleId) {
  return isRole(role) && !!ACCESS[role][module];
}
export function canWrite(role: string, module: ModuleId) {
  return isRole(role) && ACCESS[role][module] === "write";
}

/** ¿Puede abrir esta ruta? Las que no pertenecen a un módulo (p. ej. /api/logo) quedan para todos los usuarios con sesión. */
export function canOpen(role: string, pathname: string) {
  const m = moduleOf(pathname);
  return m ? canRead(role, m) : true;
}

export const MODULE_LABEL: Record<string, string> = {
  cotizaciones: "Cotizaciones",
  facturas: "Facturas",
  ordenes: "Órdenes",
  envios: "Envíos",
  clientes: "Clientes",
  tarifario: "Tarifario",
  contabilidad: "Contabilidad",
  conciliacion: "Conciliación",
  proveedores: "Proveedores",
  cxp: "Cuentas por pagar",
  nomina: "Nómina",
  usuarios: "Usuarios",
  configuracion: "Configuración",
  perfil: "Perfil",
  general: "General",
};

export const READ_ONLY_MESSAGE = "Tu rol solo permite consultar esta sección.";
