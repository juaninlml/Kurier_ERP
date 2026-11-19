type PdfResult = { filename: string; buffer: Buffer } | null;

/**
 * Responde con el PDF generado. Si la generación falla, registra el error completo
 * (visible en los logs de Vercel) y muestra una página con el motivo, en lugar de un 500 vacío.
 */
export async function pdfResponse(render: Promise<PdfResult>, download: boolean) {
  let result: PdfResult;
  try {
    result = await render;
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
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${result.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
