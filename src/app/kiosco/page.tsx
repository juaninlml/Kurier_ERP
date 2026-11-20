import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { MonitorSmartphone } from "lucide-react";
import { prisma } from "@/lib/db";
import { KioskScreen } from "@/components/KioskScreen";
import { AuthCard } from "@/components/AuthCard";
import { Form } from "@/components/Form";
import { SubmitButton } from "@/components/SubmitButton";
import { pairKiosk } from "@/app/actions/attendance";
import { Tr } from "@/components/Tr";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await getT())("Kiosco de asistencia") };
}

export default async function KioskPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const t = await getT();
  const { error } = await searchParams;
  const token = (await cookies()).get("kurier_kiosk")?.value;
  const [device, s] = await Promise.all([
    token ? prisma.kioskDevice.findUnique({ where: { tokenHash: createHash("sha256").update(token).digest("hex") } }) : null,
    prisma.companySettings.findUnique({ where: { id: 1 }, select: { tradeName: true, timezone: true } }),
  ]);

  if (!device?.active) {
    return (
      <AuthCard>
        <div className="mb-3 grid size-10 place-items-center rounded-full bg-amber-100 text-amber-700">
          <MonitorSmartphone className="size-5" />
        </div>
        <h1 className="text-lg font-semibold"><Tr>Tablet no autorizada</Tr></h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {error === "activacion"
            ? t("El link de autorización ya se usó o fue cancelado. Autoriza la tablet aquí con tu código.")
            : t("Un administrador puede autorizarla aquí con su correo y el código de su app autenticadora.")}
        </p>
        <Form action={pairKiosk} className="mt-5 space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground"><Tr>Nombre de la tablet</Tr></span>
            <input name="name" required defaultValue="Tablet almacén" className="input" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground"><Tr>Correo del administrador</Tr></span>
            <input name="email" type="email" required autoComplete="off" className="input" placeholder={t("nombre@empresa.com")} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground"><Tr>Código de tu app autenticadora</Tr></span>
            <input name="code" required inputMode="numeric" pattern="[0-9 ]{6,7}" maxLength={7} autoComplete="one-time-code" className="input text-center font-mono text-lg tracking-[0.4em]" placeholder="000000" />
          </label>
          <SubmitButton className="btn-primary w-full" pendingText={t("Autorizando…")}>
            <Tr>Autorizar y abrir el kiosco</Tr>
          </SubmitButton>
        </Form>
        <p className="mt-4 text-xs text-muted-foreground"><Tr>También puedes escanear con la cámara de la tablet el QR que aparece en Nómina → Asistencias → Kioscos.</Tr></p>
      </AuthCard>
    );
  }

  return <KioskScreen company={s?.tradeName ?? "Kurier"} device={device.name} tz={s?.timezone || "America/Mexico_City"} />;
}
