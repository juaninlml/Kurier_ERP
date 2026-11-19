import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Secret, TOTP } from "otpauth";
import QRCode from "qrcode";

/**
 * Autenticador (TOTP, RFC 6238): códigos de 6 dígitos cada 30 s, compatibles con
 * Google Authenticator, Microsoft Authenticator, Authy, 1Password, etc.
 * El secreto de cada usuario se guarda cifrado con AES-256-GCM (llave derivada de AUTH_SECRET).
 */
const ISSUER = "Kurier ERP";
const PERIOD = 30;

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("Falta AUTH_SECRET en las variables de entorno.");
  return createHash("sha256").update(`kurier-totp:${secret}`).digest();
}

export function encryptSecret(base32: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(base32, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${enc.toString("base64url")}`;
}

export function decryptSecret(stored: string) {
  const [v, iv, tag, data] = stored.split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Secreto del autenticador inválido.");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]).toString("utf8");
}

/** Secreto nuevo (base32) para vincular un teléfono. */
export const newSecret = () => new Secret({ size: 20 }).base32;

const totpFor = (email: string, base32: string) =>
  new TOTP({ issuer: ISSUER, label: email, algorithm: "SHA1", digits: 6, period: PERIOD, secret: Secret.fromBase32(base32) });

/** URI otpauth:// que se convierte en QR. */
export const otpauthUri = (email: string, base32: string) => totpFor(email, base32).toString();

/** QR en SVG listo para mostrarse en la página. */
export const qrSvg = (uri: string) => QRCode.toString(uri, { type: "svg", margin: 1, errorCorrectionLevel: "M", width: 220 });

/** Clave para captura manual, en grupos de 4 ("ABCD EFGH …"). */
export const formatSecret = (base32: string) => base32.replace(/(.{4})/g, "$1 ").trim();

export const normalizeCode = (code: string) => code.replace(/\D/g, "").slice(0, 6);

/**
 * Verifica un código (acepta ±1 periodo de tolerancia por desfase del reloj del teléfono).
 * Regresa el número de periodo usado, o null si no es válido o ya se usó (step <= lastStep).
 */
export function verifyCode(base32: string, code: string, lastStep = 0): number | null {
  const c = normalizeCode(code);
  if (c.length !== 6) return null;
  const totp = totpFor("x", base32);
  const delta = totp.validate({ token: c, window: 1 });
  if (delta === null) return null;
  const step = Math.floor(Date.now() / 1000 / PERIOD) + delta;
  return step > lastStep ? step : null;
}

/** Comparación en tiempo constante (clave de instalación). */
export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
