import { headers } from "next/headers";
import { serviceLevelOf } from "./lastmile-zones";

/** Dirección base del sitio (para links de rastreo en WhatsApp y en el QR de la guía). */
export async function siteOrigin() {
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
}

/** "lm4lkc7akw" o "LM-4LKC-7AKW" → "LM-4LKC-7AKW" (vacío si no tiene forma de guía). */
export function normalizeTracking(raw: string) {
  const c = decodeURIComponent(raw).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^LM[A-Z0-9]{8}$/.test(c) ? `LM-${c.slice(2, 6)}-${c.slice(6)}` : "";
}

export const trackingUrl = (origin: string, tracking: string) => `${origin}/rastreo/${tracking}`;

/** Solo el primer nombre (la página de rastreo es pública: no expone nombre completo ni teléfono). */
export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";

type ForMessage = { tracking: string; status: string; destName: string; originName: string; originCompany: string; serviceLevel: string; cod: number };

/** Mensaje de WhatsApp para el destinatario, según el estatus de la guía. */
export function whatsappMessage(s: ForMessage, url: string) {
  const who = firstName(s.destName);
  const from = s.originCompany || s.originName;
  const when = serviceLevelOf(s.serviceLevel) === "DIA_SIGUIENTE" ? "al día siguiente" : "hoy mismo";
  const status =
    s.status === "ENTREGADA"
      ? `fue entregado. ¡Gracias por tu compra!`
      : s.status === "EN_RUTA"
        ? `ya va en camino y llega hoy.`
        : s.status === "CANCELADA"
          ? `fue cancelado. Si tienes dudas, contacta a ${from || "la tienda"}.`
          : `ya está registrado con Kurier Kido y se entrega ${when}.`;
  const cod = s.cod > 0 && s.status !== "ENTREGADA" && s.status !== "CANCELADA" ? `\nTen listo el pago contra entrega: $${s.cod.toLocaleString("es-MX", { minimumFractionDigits: 2 })}.` : "";
  return `Hola ${who}, tu paquete${from ? ` de ${from}` : ""} ${status}${cod}\nGuía: ${s.tracking}\nRastréalo aquí: ${url}`;
}

/** Link de WhatsApp (wa.me) al teléfono del destinatario con el mensaje escrito. Teléfonos MX de 10 dígitos. */
export const whatsappLink = (phone: string, text: string) => `https://wa.me/${phone.length === 10 ? `52${phone}` : phone}?text=${encodeURIComponent(text)}`;
