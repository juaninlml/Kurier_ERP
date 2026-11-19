import { MonitorSmartphone } from "lucide-react";
import { prisma } from "@/lib/db";
import { activateKiosk } from "@/app/actions/attendance";
import { AuthCard } from "@/components/AuthCard";
import { Form } from "@/components/Form";
import { SubmitButton } from "@/components/SubmitButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Autorizar tablet" };

/**
 * Abrir el link (o escanear el QR) solo muestra esta pantalla; la tablet queda autorizada al tocar el botón.
 * Así las vistas previas de WhatsApp o del navegador no gastan el link.
 */
export default async function ActivateKioskPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const device = token ? await prisma.kioskDevice.findFirst({ where: { activationToken: token, active: true }, select: { name: true } }) : null;
  return (
    <AuthCard>
      <div className="mb-3 grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
        <MonitorSmartphone className="size-5" />
      </div>
      {device ? (
        <>
          <h1 className="text-lg font-semibold">Autorizar esta tablet</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Quedará como kiosco de asistencia <span className="font-medium text-foreground">«{device.name}»</span>. Ábrelo solo en la tablet que usarán los empleados.
          </p>
          <Form action={activateKiosk.bind(null, token)} className="mt-5">
            <SubmitButton className="btn-primary w-full" pendingText="Autorizando…">
              Autorizar y abrir el kiosco
            </SubmitButton>
          </Form>
        </>
      ) : (
        <>
          <h1 className="text-lg font-semibold">Link no válido</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Este link ya se usó o fue cancelado. Abre <span className="font-mono">/kiosco</span> en la tablet y autorízala con tu código, o genera un link nuevo en Nómina → Asistencias → Kioscos.
          </p>
        </>
      )}
    </AuthCard>
  );
}
