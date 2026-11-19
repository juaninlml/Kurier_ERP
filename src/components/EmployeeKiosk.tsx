import { QrCode, ShieldCheck, Smartphone, Unlink } from "lucide-react";
import type { Employee } from "@prisma/client";
import { confirmEmployeeKiosk, startEmployeeKiosk, unlinkEmployeeKiosk } from "@/app/actions/attendance";
import { Panel } from "./kit";
import { Form } from "./Form";
import { SubmitButton } from "./SubmitButton";
import { ConfirmButton } from "./ConfirmButton";
import { decryptSecret, formatSecret, otpauthUri, qrSvg } from "@/lib/totp";

/** Vincula la app autenticadora del empleado para checar en el kiosco. */
export async function EmployeeKiosk({ e }: { e: Employee }) {
  const label = `${e.name} (#${e.id})`;
  const pending = e.kioskPendingSecret ? decryptSecret(e.kioskPendingSecret) : null;
  const svg = pending ? await qrSvg(otpauthUri(label, pending, "Kurier Asistencia")) : null;

  return (
    <Panel
      title="Autenticador para checar asistencia"
      description="El empleado escanea este QR con Google Authenticator (u otra app) en su teléfono. En el kiosco solo escribe el código de 6 dígitos."
    >
      {e.kioskSecret && !pending ? (
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-full bg-emerald-50 text-emerald-700">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <div className="font-medium">Vinculado</div>
              <div className="text-xs text-muted-foreground">Puede checar en el kiosco con el código de su app.</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Form action={startEmployeeKiosk.bind(null, e.id)}>
              <SubmitButton className="btn-secondary h-8 text-xs" pendingText="Generando…">
                <Smartphone className="size-3.5" /> Cambiar de teléfono
              </SubmitButton>
            </Form>
            <Form action={unlinkEmployeeKiosk.bind(null, e.id)}>
              <ConfirmButton message={`¿Desvincular el autenticador de ${e.name}? Ya no podrá checar hasta volver a vincularlo.`} className="btn-danger h-8 text-xs">
                <Unlink className="size-3.5" /> Desvincular
              </ConfirmButton>
            </Form>
          </div>
        </div>
      ) : pending && svg ? (
        <div className="grid gap-5 p-5 sm:grid-cols-[220px_minmax(0,1fr)]">
          <div className="rounded-xl border bg-white p-2">
            <div className="aspect-square [&>svg]:size-full" role="img" aria-label="Código QR del autenticador" dangerouslySetInnerHTML={{ __html: svg }} />
          </div>
          <div className="space-y-3 text-sm">
            <ol className="list-decimal space-y-1 pl-4">
              <li>En el teléfono del empleado abre Google Authenticator (o Microsoft Authenticator / Authy).</li>
              <li>Toca «+» → «Escanear un código QR» y escanea el código.</li>
              <li>Escribe aquí el código de 6 dígitos que aparece para confirmar.</li>
            </ol>
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer hover:text-foreground">Clave para captura manual</summary>
              <code className="mt-1 block rounded bg-muted px-2 py-1 font-mono text-foreground select-all">{formatSecret(pending)}</code>
            </details>
            <Form action={confirmEmployeeKiosk.bind(null, e.id)} className="flex flex-wrap items-end gap-2">
              <input
                name="code"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={7}
                placeholder="000000"
                aria-label="Código de 6 dígitos"
                className="input h-10 w-40 text-center font-mono text-lg tracking-[0.3em]"
              />
              <SubmitButton className="btn-primary h-10" pendingText="Verificando…">
                Confirmar
              </SubmitButton>
            </Form>
            {e.kioskSecret && <p className="text-xs text-amber-700">Al confirmar, el teléfono anterior deja de funcionar.</p>}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="text-sm text-muted-foreground">Aún no tiene autenticador. Sin él no puede checar en el kiosco.</p>
          <Form action={startEmployeeKiosk.bind(null, e.id)}>
            <SubmitButton className="btn-primary" pendingText="Generando…">
              <QrCode className="size-4" /> Generar QR
            </SubmitButton>
          </Form>
        </div>
      )}
    </Panel>
  );
}
