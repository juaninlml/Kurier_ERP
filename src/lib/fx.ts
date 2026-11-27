/**
 * Tipo de cambio de referencia CNY → MXN (MXN por 1 CNY) para sugerirlo en el formulario de facturas.
 * Fuente pública y gratuita, sin clave ni datos del usuario: Frankfurter (tipos de referencia del Banco
 * Central Europeo, se publican en días hábiles). Se guarda en caché 6 h; si falla, el campo queda manual.
 */
export async function suggestedCnyRate(): Promise<{ rate: number; date: string } | null> {
  try {
    const res = await fetch("https://api.frankfurter.dev/v1/latest?base=CNY&symbols=MXN", {
      next: { revalidate: 21600 },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { date?: string; rates?: { MXN?: number } };
    const rate = Number(data.rates?.MXN);
    if (!Number.isFinite(rate) || rate <= 0) return null;
    return { rate: Math.round(rate * 10000) / 10000, date: String(data.date ?? "") };
  } catch {
    return null;
  }
}
