/** Tipos de seguimiento de cobranza (sin dependencias de servidor: lo usan también los componentes del navegador). */
export const CONTACT_KINDS = ["LLAMADA", "WHATSAPP", "CORREO", "VISITA", "NOTA"] as const;
export type ContactKind = (typeof CONTACT_KINDS)[number];
export const CONTACT_LABEL: Record<ContactKind, string> = {
  LLAMADA: "Llamada",
  WHATSAPP: "WhatsApp",
  CORREO: "Correo",
  VISITA: "Visita",
  NOTA: "Nota",
};
export const isContactKind = (v: unknown): v is ContactKind => (CONTACT_KINDS as readonly string[]).includes(v as string);
