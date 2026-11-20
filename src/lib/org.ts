/*
 * Estructura de la plantilla: Área › Departamento › Puesto (ej. Almacén › Packing › Sistema packing).
 * El catálogo vive en JobPosition; el empleado guarda una copia de área y departamento para agrupar.
 */

export type OrgPosition = {
  id: number;
  area: string;
  department: string;
  name: string;
};
type OrgOf = { area: string; department: string };

export type OrgGroup<T> = {
  area: string;
  departments: { department: string; items: T[] }[];
  count: number;
};

/**
 * Agrupa por área y luego por departamento, en el orden del catálogo. Las áreas o
 * departamentos fuera del catálogo van después (alfabético) y "sin área" al final.
 */
export function groupByOrg<T>(items: T[], of: (item: T) => OrgOf, catalog: OrgPosition[] = []): OrgGroup<T>[] {
  const rank = new Map<string, number>();
  catalog.forEach((p, i) => {
    if (!rank.has(p.area)) rank.set(p.area, i);
    const k = `${p.area}\u0000${p.department}`;
    if (!rank.has(k)) rank.set(k, i);
  });
  const order = (key: string, label: string) => (label ? (rank.get(key) ?? 1e6) : 2e6);
  const cmp = (a: [number, string], b: [number, string]) => a[0] - b[0] || a[1].localeCompare(b[1], "es");

  const areas = new Map<string, Map<string, T[]>>();
  for (const it of items) {
    const { area, department } = of(it);
    const a = area.trim();
    const d = department.trim();
    if (!areas.has(a)) areas.set(a, new Map());
    const deps = areas.get(a)!;
    if (!deps.has(d)) deps.set(d, []);
    deps.get(d)!.push(it);
  }

  return [...areas.entries()]
    .sort(([a], [b]) => cmp([order(a, a), a], [order(b, b), b]))
    .map(([area, deps]) => {
      const departments = [...deps.entries()]
        .sort(([a], [b]) => cmp([order(`${area}\u0000${a}`, a), a], [order(`${area}\u0000${b}`, b), b]))
        .map(([department, list]) => ({ department, items: list }));
      return {
        area,
        departments,
        count: departments.reduce((n, d) => n + d.items.length, 0),
      };
    });
}

/** Orden plano (área, departamento, nombre) — para los recibos PDF. */
export function sortByOrg<T extends OrgOf & { name: string }>(items: T[], catalog: OrgPosition[] = []): T[] {
  return groupByOrg(items, (x) => x, catalog).flatMap((g) => g.departments.flatMap((d) => d.items));
}
