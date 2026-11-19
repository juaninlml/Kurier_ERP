import { createSign } from "node:crypto";

/*
 * Google Drive (Workspace) con una cuenta de servicio, sin dependencias: JWT firmado con
 * node:crypto y la API REST v3. Los archivos viven en una unidad compartida (las cuentas de
 * servicio no tienen espacio propio), así que la empresa es dueña de los documentos.
 *
 * Variables de entorno:
 *   GOOGLE_DRIVE_CLIENT_EMAIL  correo de la cuenta de servicio (…@….iam.gserviceaccount.com)
 *   GOOGLE_DRIVE_PRIVATE_KEY   clave privada del JSON de la cuenta ("-----BEGIN PRIVATE KEY-----…")
 *   GOOGLE_DRIVE_FOLDER_ID     carpeta raíz dentro de la unidad compartida (o el id de la unidad)
 */

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const FOLDER = "application/vnd.google-apps.folder";
const ALL = "supportsAllDrives=true";

export const driveConfigured = () =>
  Boolean(process.env.GOOGLE_DRIVE_CLIENT_EMAIL && process.env.GOOGLE_DRIVE_PRIVATE_KEY && process.env.GOOGLE_DRIVE_FOLDER_ID);

const rootId = () => process.env.GOOGLE_DRIVE_FOLDER_ID!.trim();

let token: { value: string; exp: number } | null = null;

async function accessToken() {
  if (token && token.exp > Date.now() + 60_000) return token.value;
  const email = process.env.GOOGLE_DRIVE_CLIENT_EMAIL!.trim();
  // En Vercel la clave suele pegarse con "\n" literales.
  const key = process.env.GOOGLE_DRIVE_PRIVATE_KEY!.replace(/\\n/g, "\n").replace(/^"|"$/g, "");
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: email,
    scope: "https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  let signature: string;
  try {
    signature = createSign("RSA-SHA256").update(unsigned).sign(key, "base64url");
  } catch {
    throw new Error("GOOGLE_DRIVE_PRIVATE_KEY no es una clave privada válida (copia el campo private_key del JSON completo).");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` }),
  });
  const data = (await res.json()) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!res.ok || !data.access_token) throw new Error(`Google rechazó la cuenta de servicio: ${data.error_description ?? res.status}`);
  token = { value: data.access_token, exp: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return token.value;
}

async function call<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${await accessToken()}`, ...init.headers } });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    const err = new Error(`Drive ${res.status}: ${body.error?.message ?? res.statusText}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return (await res.json()) as T;
}

const q = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
// Drive acepta casi cualquier nombre; se quitan "/" para que no parezcan subcarpetas.
const clean = (s: string) => s.replace(/[/\\]+/g, "-").trim() || "Sin nombre";

const folders = new Map<string, string>();

async function folderIn(parent: string, name: string) {
  const k = `${parent}/${name}`;
  const hit = folders.get(k);
  if (hit) return hit;
  const found = await call<{ files: { id: string }[] }>(
    `${API}/files?${ALL}&includeItemsFromAllDrives=true&corpora=allDrives&fields=files(id)&q=${encodeURIComponent(
      `'${parent}' in parents and name = '${q(name)}' and mimeType = '${FOLDER}' and trashed = false`,
    )}`,
  );
  const id =
    found.files[0]?.id ??
    (await call<{ id: string }>(`${API}/files?${ALL}&fields=id`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, mimeType: FOLDER, parents: [parent] }),
    })).id;
  folders.set(k, id);
  return id;
}

/** Crea (si no existen) las carpetas de la ruta bajo la raíz y regresa el id de la última. */
export async function ensurePath(path: string[]) {
  let parent = rootId();
  for (const part of path) parent = await folderIn(parent, clean(part));
  return parent;
}

function multipart(meta: object, pdf: Buffer) {
  const boundary = `kurier${Date.now().toString(36)}`;
  const head = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`,
  );
  return { body: Buffer.concat([head, pdf, Buffer.from(`\r\n--${boundary}--`)]), type: `multipart/related; boundary=${boundary}` };
}

export type DriveUpload = { id: string; link: string; folderId: string };

/**
 * Sube el PDF a la carpeta. Si ya existía (fileId), lo reemplaza: Drive conserva la versión
 * anterior en su historial, así que cada documento guarda todas sus emisiones.
 */
export async function uploadPdf({ path, name, pdf, fileId }: { path: string[]; name: string; pdf: Buffer; fileId?: string }): Promise<DriveUpload> {
  const folderId = await ensurePath(path);
  const fields = "fields=id,webViewLink,parents";
  type File = { id: string; webViewLink: string; parents?: string[] };
  if (fileId) {
    try {
      const cur = await call<File>(`${API}/files/${fileId}?${ALL}&fields=parents,trashed`);
      // Si cambió la carpeta (otro año, cliente renombrado…), se mueve.
      const move = cur.parents && !cur.parents.includes(folderId) ? `&addParents=${folderId}&removeParents=${cur.parents.join(",")}` : "";
      const m = multipart({ name }, pdf);
      const f = await call<File>(`${UPLOAD}/files/${fileId}?uploadType=multipart&${ALL}&${fields}${move}`, {
        method: "PATCH",
        headers: { "Content-Type": m.type },
        body: new Uint8Array(m.body),
      });
      return { id: f.id, link: f.webViewLink, folderId };
    } catch (e) {
      // Lo borraron en Drive: se vuelve a crear.
      if ((e as { status?: number }).status !== 404) throw e;
    }
  }
  const m = multipart({ name, parents: [folderId], mimeType: "application/pdf" }, pdf);
  const f = await call<File>(`${UPLOAD}/files?uploadType=multipart&${ALL}&${fields}`, { method: "POST", headers: { "Content-Type": m.type }, body: new Uint8Array(m.body) });
  return { id: f.id, link: f.webViewLink, folderId };
}

/** Comprueba credenciales y acceso a la carpeta raíz. */
export async function driveCheck(): Promise<{ ok: true; name: string; link: string } | { ok: false; error: string }> {
  try {
    const f = await call<{ name: string; webViewLink?: string; id: string }>(`${API}/files/${rootId()}?${ALL}&fields=id,name,webViewLink`);
    return { ok: true, name: f.name, link: f.webViewLink ?? `https://drive.google.com/drive/folders/${f.id}` };
  } catch (e) {
    const msg = (e as Error).message;
    return {
      ok: false,
      error: /404/.test(msg)
        ? "No se encontró la carpeta. Revisa GOOGLE_DRIVE_FOLDER_ID y que la cuenta de servicio sea miembro de la unidad compartida."
        : msg,
    };
  }
}
