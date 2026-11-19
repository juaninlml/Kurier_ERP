import { CircleAlert, CircleCheck, CloudUpload, ExternalLink, FolderTree } from "lucide-react";
import { prisma } from "@/lib/db";
import { driveCheck, driveConfigured } from "@/lib/drive";
import { KIND_LABEL, pendingRefs, refLabel, type ArchiveKind } from "@/lib/archive";
import { syncDrive } from "@/app/actions/drive";
import { Form } from "@/components/Form";
import { SubmitButton } from "@/components/SubmitButton";
import { formatDate } from "@/lib/money";

const STEPS = [
  "En Google Cloud Console crea un proyecto (o usa uno existente) y activa la «Google Drive API».",
  "En «IAM y administración → Cuentas de servicio» crea una cuenta de servicio y genera una clave tipo JSON.",
  "En Google Drive crea una unidad compartida (ej. «Kurier ERP»), y en «Administrar miembros» agrega el correo de la cuenta de servicio como «Administrador de contenido».",
  "Abre la unidad (o una carpeta dentro de ella) y copia el id que aparece en la dirección después de /folders/.",
  "En Vercel → Settings → Environment Variables agrega GOOGLE_DRIVE_CLIENT_EMAIL (client_email del JSON), GOOGLE_DRIVE_PRIVATE_KEY (private_key del JSON) y GOOGLE_DRIVE_FOLDER_ID. Luego vuelve a desplegar.",
];

/** Estado de la copia en Google Drive (Configuración). */
export async function DrivePanel() {
  const configured = driveConfigured();
  return (
    <section className="card mt-6 p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Google Drive</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Copia en PDF de facturas, cotizaciones, nóminas pagadas y resúmenes de órdenes facturados, ordenada en carpetas por cliente y año.
          </p>
        </div>
      </div>
      {configured ? <Connected /> : <Setup />}
    </section>
  );
}

function Setup() {
  return (
    <div className="rounded-lg border border-dashed p-4">
      <p className="mb-3 flex items-center gap-2 text-sm font-medium">
        <CircleAlert className="size-4 text-muted-foreground" aria-hidden />
        Sin configurar. Los documentos se siguen generando al abrirlos; solo falta la copia en Drive.
      </p>
      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
        {STEPS.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
    </div>
  );
}

async function Connected() {
  const [check, { total, pending }, errors, counts] = await Promise.all([
    driveCheck(),
    pendingRefs(),
    prisma.driveFile.findMany({ where: { error: { not: "" } }, orderBy: { updatedAt: "desc" }, take: 5, select: { refKey: true, error: true, updatedAt: true } }),
    prisma.driveFile.groupBy({ by: ["kind"], where: { fileId: { not: "" } }, _count: true }),
  ]);
  const saved = counts.reduce((a, c) => a + c._count, 0);
  const pct = total ? Math.round(((total - pending.length) / total) * 100) : 100;

  return (
    <div className="space-y-4">
      {check.ok ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <span className="flex items-center gap-2">
            <CircleCheck className="size-4" aria-hidden />
            Conectado a la carpeta <strong className="font-semibold">{check.name}</strong>
          </span>
          <a href={check.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline">
            Abrir en Drive
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            No se pudo conectar: {check.error}
          </span>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <div className="mb-1.5 flex items-baseline justify-between text-sm">
            <span className="font-medium">
              {total - pending.length} de {total} documentos en Drive
            </span>
            <span className="text-muted-foreground tabular-nums">{pct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="viz-grow-right h-full rounded-full" style={{ width: `${pct}%`, background: "var(--chart-1)" }} />
          </div>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {(Object.keys(KIND_LABEL) as ArchiveKind[]).map((k) => (
              <span key={k}>
                {KIND_LABEL[k]}: <span className="font-medium text-foreground tabular-nums">{counts.find((c) => c.kind === k)?._count ?? 0}</span>
              </span>
            ))}
            {saved === 0 && <span>Aún no se ha subido ningún documento.</span>}
          </p>
        </div>
        <Form action={syncDrive} successMessage="Lote subido." className="flex flex-col items-end gap-1">
          <SubmitButton className="btn-primary" pendingText="Subiendo…">
            <CloudUpload className="size-4" />
            {pending.length ? `Subir pendientes (${pending.length})` : "Revisar de nuevo"}
          </SubmitButton>
          {pending.length > 15 && <span className="text-xs text-muted-foreground">Sube de 15 en 15; repite hasta terminar.</span>}
        </Form>
      </div>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <FolderTree className="mt-px size-3.5 shrink-0" aria-hidden />
        Clientes / cliente / Facturas · Cotizaciones · Resúmenes de órdenes / año — Nómina / año / semana. Al editar un documento se reemplaza su PDF y Drive conserva la versión anterior en su historial.
      </p>

      {errors.length > 0 && (
        <div className="rounded-lg border">
          <p className="border-b px-4 py-2 text-xs font-medium text-muted-foreground">Últimos errores</p>
          <ul className="divide-y text-sm">
            {errors.map((e) => (
              <li key={e.refKey} className="flex flex-wrap justify-between gap-2 px-4 py-2">
                <span className="font-medium">{refLabel(e.refKey)}</span>
                <span className="min-w-0 flex-1 text-right text-muted-foreground">
                  {e.error} · {formatDate(e.updatedAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
