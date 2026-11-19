import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { MonitorSmartphone } from "lucide-react";
import { prisma } from "@/lib/db";
import { KioskScreen } from "@/components/KioskScreen";
import { AuthCard } from "@/components/AuthCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Kiosco de asistencia" };

export default async function KioskPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
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
        <h1 className="text-lg font-semibold">Tablet no autorizada</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {error === "activacion"
            ? "El link de autorización ya se usó o fue cancelado. Genera uno nuevo en Nómina → Asistencias → Kioscos."
            : "Para usar esta tablet como kiosco, abre en ella el link de autorización que se genera en Nómina → Asistencias → Kioscos."}
        </p>
      </AuthCard>
    );
  }

  return <KioskScreen company={s?.tradeName ?? "Kurier"} device={device.name} tz={s?.timezone || "America/Mexico_City"} />;
}
