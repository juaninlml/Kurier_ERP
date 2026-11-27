"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { ensureGeo } from "@/lib/geocode";
import { prisma } from "@/lib/db";
import { assertSignedIn, safe } from "@/lib/safe-action";
import { getCurrentUser } from "@/lib/current-user";
import { newTracking, quoteLastMile, SERVICE_LEVELS, serviceLevelOf, SHIPMENT_STATUS, ZIP_RE, type LastMileQuote } from "@/lib/lastmile";
import { resolveLocation, type LocationResult } from "@/lib/location";
import { numv, str } from "./helpers";
import { UserError } from "@/lib/user-error";

const who = async () => {
  const me = await getCurrentUser();
  return me.name || me.email;
};

/** Cotización para el formulario (no guarda nada). */
export async function quoteShipment(input: { zip: string; borough?: string; clientId?: number | null }): Promise<LastMileQuote> {
  try {
    await assertSignedIn("envios");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  return quoteLastMile(input);
}

const ADDRESS_FIELDS = ["name", "company", "email", "phone", "street", "number", "colony", "city", "state", "zip", "reference", "rfc"] as const;
type AddressInput = Partial<Record<(typeof ADDRESS_FIELDS)[number] | "alias", string>>;

/** Guarda (o actualiza, si ya existe la misma) una dirección en la libreta. */
export async function saveShipAddress(kind: "ORIGEN" | "DESTINO", input: AddressInput): Promise<{ ok: true; id: number } | { error: string }> {
  try {
    await assertSignedIn("envios");
  } catch (e) {
    return { error: (e as Error).message };
  }
  const data = Object.fromEntries(ADDRESS_FIELDS.map((k) => [k, String(input[k] ?? "").trim()])) as Record<(typeof ADDRESS_FIELDS)[number], string>;
  if (!data.name || !data.street || !ZIP_RE.test(data.zip)) return { error: "Para guardar la dirección se necesitan nombre, calle y CP de 5 dígitos." };
  const alias = String(input.alias ?? "").trim();
  const same = await prisma.shipAddress.findFirst({ where: { kind, name: data.name, street: data.street, number: data.number, zip: data.zip } });
  const saved = same
    ? await prisma.shipAddress.update({ where: { id: same.id }, data: { ...data, alias: alias || same.alias } })
    : await prisma.shipAddress.create({ data: { ...data, alias, kind } });
  revalidatePath("/envios/nuevo");
  return { ok: true, id: saved.id };
}

/** Teléfono: solo dígitos; para MX, 10 dígitos (se aceptan +52 / 52 al inicio). */
function phoneOf(raw: string, required: boolean, label: string) {
  const digits = raw.replace(/\D/g, "").replace(/^52(?=\d{10}$)/, "");
  if (!digits) {
    if (required) throw new UserError("Escribe el teléfono de {v0}.", { v0: label });
    return "";
  }
  if (digits.length !== 10) throw new UserError("El teléfono de {v0} debe tener 10 dígitos.", { v0: label });
  return digits;
}

function addressOf(fd: FormData, p: "origin" | "dest") {
  const label = p === "origin" ? "origen" : "destino";
  const g = (k: string) => str(fd, `${p}${k}`);
  const a = {
    Name: g("Name"),
    Company: g("Company"),
    Email: g("Email"),
    Phone: phoneOf(g("Phone"), p === "dest", label === "origen" ? "quien envía" : "quien recibe"),
    Street: g("Street"),
    Number: g("Number"),
    Colony: g("Colony"),
    City: g("City"),
    State: g("State"),
    Zip: g("Zip"),
    Ref: g("Ref"),
  };
  if (!a.Name) throw new UserError("Escribe el nombre completo de {v0}.", { v0: label });
  if (!a.Street) throw new UserError("Escribe la calle de {v0}.", { v0: label });
  if (!ZIP_RE.test(a.Zip)) throw new UserError("El CP de {v0} debe tener 5 dígitos.", { v0: label });
  if (a.Email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.Email)) throw new UserError("Revisa el correo de {v0}.", { v0: label });
  return Object.fromEntries(Object.entries(a).map(([k, v]) => [`${p}${k}`, v])) as Record<string, string>;
}

/** Revisa el link de ubicación en el formulario (no guarda nada). */
export async function checkLocation(text: string, borough: string): Promise<LocationResult> {
  try {
    await assertSignedIn("envios");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  return resolveLocation(text, borough);
}

/** Ubicación del formulario: vacío = sin coordenadas; si hay link, debe traer coordenadas válidas. */
async function locationOf(fd: FormData, borough: string) {
  const url = str(fd, "destLocation").slice(0, 1000);
  if (!url) return { destLocationUrl: "", destLat: null, destLng: null };
  const r = await resolveLocation(url, borough);
  if (!r.ok) throw new Error(r.error);
  return { destLocationUrl: url, destLat: r.lat, destLng: r.lng };
}

/** Genera la guía: valida, vuelve a cotizar en el servidor y la guarda con su bitácora. */
async function createShipmentImpl(fd: FormData) {
  const origin = addressOf(fd, "origin");
  const dest = addressOf(fd, "dest");
  const clientId = Math.round(numv(fd, "clientId")) || null;
  const quote = await quoteLastMile({ zip: dest.destZip, borough: str(fd, "borough"), clientId });
  if (!quote.ok) throw new Error(quote.error);
  const pos = (k: string, max: number) => {
    const v = numv(fd, k);
    if (v < 0 || v > max) throw new Error("Revisa las medidas y el peso del paquete.");
    return Math.round(v * 100) / 100;
  };
  const packages = Math.round(numv(fd, "packages", 1));
  if (packages < 1 || packages > 50) throw new Error("La cantidad de bultos debe estar entre 1 y 50.");
  const content = str(fd, "content");
  if (!content) throw new Error("Describe el contenido del paquete.");
  const location = await locationOf(fd, quote.borough);
  const by = await who();
  const { tracking, reference } = await newTracking();
  const s = await prisma.shipment.create({
    data: {
      tracking,
      reference,
      clientId,
      packageType: str(fd, "packageType") === "SOBRE" ? "SOBRE" : "CAJA",
      serviceLevel: serviceLevelOf(str(fd, "serviceLevel")),
      ...origin,
      originRfc: str(fd, "originRfc").toUpperCase(),
      ...dest,
      originZip: origin.originZip,
      destZip: dest.destZip,
      originName: origin.originName,
      originStreet: origin.originStreet,
      destName: dest.destName,
      destPhone: dest.destPhone,
      destStreet: dest.destStreet,
      borough: quote.borough,
      zone: quote.zone,
      ...location,
      content,
      lengthCm: pos("lengthCm", 300),
      widthCm: pos("widthCm", 300),
      heightCm: pos("heightCm", 300),
      weightKg: pos("weightKg", 200),
      packages,
      cod: pos("cod", 1_000_000),
      price: quote.price,
      priceLabel: quote.label,
      notes: str(fd, "notes"),
      createdBy: by,
      events: { create: { kind: "CREADA", detail: `Guía generada · ${SERVICE_LEVELS[serviceLevelOf(str(fd, "serviceLevel"))]} · ${quote.label} · ${quote.borough}${location.destLat != null ? " · con ubicación del cliente" : ""}`, by } },
    },
  });
  // Libreta de direcciones (opcional)
  const pick = (p: "origin" | "dest") => ({
    name: str(fd, `${p}Name`),
    company: str(fd, `${p}Company`),
    email: str(fd, `${p}Email`),
    phone: str(fd, `${p}Phone`),
    street: str(fd, `${p}Street`),
    number: str(fd, `${p}Number`),
    colony: str(fd, `${p}Colony`),
    city: str(fd, `${p}City`),
    state: str(fd, `${p}State`),
    zip: str(fd, `${p}Zip`),
    reference: str(fd, `${p}Ref`),
    rfc: p === "origin" ? str(fd, "originRfc") : "",
  });
  if (fd.get("saveOrigin") === "on") await saveShipAddress("ORIGEN", pick("origin"));
  if (fd.get("saveDest") === "on") await saveShipAddress("DESTINO", pick("dest"));
  // Ubicación aproximada para ordenar la ruta (solo si el cliente no mandó su link)
  if (location.destLat == null) after(() => ensureGeo([s.id]).catch(() => {}));
  revalidatePath("/envios");
  redirect(`/envios/${s.id}`);
}

const DEST_FIELDS: [string, string][] = [
  ["destName", "Nombre"],
  ["destCompany", "Empresa"],
  ["destEmail", "Email"],
  ["destPhone", "Teléfono"],
  ["destStreet", "Calle"],
  ["destNumber", "Número"],
  ["destColony", "Colonia"],
  ["destCity", "Ciudad"],
  ["destState", "Estado"],
  ["destZip", "CP"],
  ["destRef", "Referencia"],
];

/** Corrige el destinatario: guarda solo los campos que cambian y lo deja en la bitácora. Si cambia el CP, se recotiza. */
async function updateRecipientImpl(id: number, fd: FormData) {
  const s = await prisma.shipment.findUniqueOrThrow({ where: { id } });
  if (s.status === "ENTREGADA" || s.status === "CANCELADA") throw new Error("No se puede corregir una guía entregada o cancelada.");
  const changes: Record<string, string> = {};
  const log: string[] = [];
  for (const [k, label] of DEST_FIELDS) {
    let v = str(fd, k);
    if (k === "destPhone") v = phoneOf(v, true, "quien recibe");
    if (k === "destName" && !v) throw new Error("El nombre no puede quedar vacío.");
    if (k === "destStreet" && !v) throw new Error("La calle no puede quedar vacía.");
    if (k === "destZip" && !ZIP_RE.test(v)) throw new Error("El CP debe tener 5 dígitos.");
    const before = String(s[k as keyof typeof s] ?? "");
    if (v !== before) {
      changes[k] = v;
      log.push(`${label}: «${before || "—"}» → «${v || "—"}»`);
    }
  }
  // Link de ubicación: si cambia, se vuelven a tomar las coordenadas (vacío = sin ubicación)
  const loc: { destLocationUrl?: string; destLat?: number | null; destLng?: number | null } = {};
  const newUrl = str(fd, "destLocation").slice(0, 1000);
  if (fd.has("destLocation") && newUrl !== s.destLocationUrl) {
    if (newUrl) {
      const r = await resolveLocation(newUrl, changes.destZip ? undefined : s.borough);
      if (!r.ok) throw new Error(r.error);
      Object.assign(loc, { destLocationUrl: newUrl, destLat: r.lat, destLng: r.lng });
      log.push(s.destLocationUrl ? "Ubicación del cliente actualizada" : "Se agregó la ubicación del cliente");
    } else {
      Object.assign(loc, { destLocationUrl: "", destLat: null, destLng: null });
      log.push("Se quitó la ubicación del cliente");
    }
  }
  if (!log.length) return;
  const extra: { borough?: string; zone?: number; price?: number; priceLabel?: string } = {};
  if (changes.destZip) {
    const q = await quoteLastMile({ zip: changes.destZip, clientId: s.clientId });
    if (!q.ok) throw new Error(q.error);
    Object.assign(extra, { borough: q.borough, zone: q.zone, price: q.price, priceLabel: q.label });
    if (q.zone !== s.zone || q.price !== s.price) log.push(`Recotizada: ${q.label} (${q.borough})`);
  }
  await prisma.shipment.update({
    where: { id },
    data: { ...changes, ...extra, ...loc, events: { create: { kind: "CORRECCION", detail: log.join(" · "), by: await who() } } },
  });
  // Si cambió la dirección se vuelve a ubicar (ensureGeo compara la dirección guardada)
  after(() => ensureGeo([id]).catch(() => {}));
  revalidatePath(`/envios/${id}`);
  revalidatePath("/envios");
}

async function setShipmentStatusImpl(id: number, status: string) {
  if (!(status in SHIPMENT_STATUS)) throw new Error("Estatus inválido.");
  const s = await prisma.shipment.findUniqueOrThrow({ where: { id } });
  if (s.status === status) return;
  await prisma.shipment.update({
    where: { id },
    data: {
      status,
      deliveredAt: status === "ENTREGADA" ? new Date() : null,
      events: { create: { kind: "ESTATUS", detail: `${SHIPMENT_STATUS[s.status] ?? s.status} → ${SHIPMENT_STATUS[status]}`, by: await who() } },
    },
  });
  revalidatePath(`/envios/${id}`);
  revalidatePath("/envios");
}

async function deleteShipAddressImpl(id: number) {
  await prisma.shipAddress.delete({ where: { id } });
  revalidatePath("/envios/nuevo");
}

export const createShipment = safe(createShipmentImpl, "envios", "createShipmentImpl");
export const updateRecipient = safe(updateRecipientImpl, "envios", "updateRecipientImpl");
export const setShipmentStatus = safe(setShipmentStatusImpl, "envios", "setShipmentStatusImpl");
export const deleteShipAddress = safe(deleteShipAddressImpl, "envios", "deleteShipAddressImpl");
