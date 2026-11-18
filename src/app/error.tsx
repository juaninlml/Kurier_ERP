"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto mt-16 max-w-lg card p-6">
      <h1 className="text-lg font-semibold text-rose-700">No se pudo completar la operación</h1>
      <p className="mt-2 text-sm text-slate-700">{error.message || "Ocurrió un error inesperado."}</p>
      <div className="mt-5 flex gap-2">
        <button onClick={() => history.back()} className="btn-secondary">
          ← Regresar
        </button>
        <button onClick={reset} className="btn-primary">
          Reintentar
        </button>
      </div>
    </div>
  );
}
