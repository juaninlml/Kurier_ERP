import { getSessionUser } from "@/lib/current-user";

type PdfResult = { filename: string; buffer: Buffer } | null;

/** Nombre de archivo seguro para Content-Disposition (sin comillas ni saltos de línea; acentos en filename*). */
function disposition(download: boolean, filename: string) {
  const ascii = filename.normalize("NFD").replace(/\p{M}/gu, "").replace(/[^\w.\- ]/g, "_");
  return `${download ? "attachment" : "inline"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/** Sesión activa para las rutas /api (además del proxy, que solo revisa el JWT): un usuario desactivado ya no descarga nada. */
export async function requireApiUser() {
  return (await getSessionUser()) ? null : new Response("No autorizado", { status: 401, headers: { "Cache-Control": "no-store" } });
}

/**
 * Responde con el PDF generado. Si la generación falla, registra el error completo
 * (visible en los logs de Vercel) y muestra una página con el motivo, en lugar de un 500 vacío.
 */
export async function pdfResponse(render: () => Promise<PdfResult>, download: boolean) {
  const denied = await requireApiUser();
  if (denied) return denied;
  let result: PdfResult;
  try {
    result = await render();
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error("[pdf] Error al generar el PDF:", err);
    return new Response(
      `No se pudo generar el PDF.\n\nMotivo: ${err.name}: ${err.message}\n\nEl detalle completo quedó en los logs del servidor (Vercel → Logs, filtra por /api/pdf).`,
      { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } },
    );
  }
  if (!result) return new Response("No encontrado", { status: 404 });
  return new Response(new Uint8Array(result.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": disposition(download, result.filename),
      "Cache-Control": "no-store",
    },
  });
}
