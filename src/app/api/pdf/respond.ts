export function pdfResponse(result: { filename: string; buffer: Buffer } | null, download: boolean) {
  if (!result) return new Response("No encontrado", { status: 404 });
  return new Response(new Uint8Array(result.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${result.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
