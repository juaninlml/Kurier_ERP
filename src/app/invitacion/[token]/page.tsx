import { MailCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { acceptInvitation } from "@/app/actions/account";
import { AuthCard, GoogleLogo } from "@/components/AuthCard";
import { getLang, getT } from "@/lib/i18n/server";
import { localeOf } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invitación" };

const ROLE: Record<string, string> = { ADMIN: "Administrador", USER: "Usuario" };

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [inv, t, lang] = await Promise.all([
    prisma.invitation.findUnique({ where: { token }, include: { createdBy: { select: { name: true, email: true } } } }),
    getT(),
    getLang(),
  ]);
  const valid = inv && !inv.usedAt && !inv.revokedAt && inv.expiresAt > new Date();

  if (!valid) {
    return (
      <AuthCard>
        <div className="mb-3 grid size-10 place-items-center rounded-full bg-amber-100 text-amber-700">
          <TriangleAlert className="size-5" />
        </div>
        <h1 className="text-lg font-semibold">{t("Invitación no válida")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("El link ya se usó, venció o fue cancelado. Pide uno nuevo a quien te invitó.")}</p>
        <Link href="/login" className="btn-secondary mt-6 w-full">
          {t("Ir a iniciar sesión")}
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <div className="mb-3 grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
        <MailCheck className="size-5" />
      </div>
      <h1 className="text-lg font-semibold">{t("Te invitaron a Kurier ERP")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("{name} te dio acceso como {role}.", { name: inv.createdBy.name || inv.createdBy.email, role: t(ROLE[inv.role] ?? inv.role) })}
      </p>
      <dl className="mt-4 space-y-1 rounded-lg bg-muted/50 p-3 text-sm">
        {inv.email && (
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">{t("Para")}</dt>
            <dd className="font-medium">{inv.email}</dd>
          </div>
        )}
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{t("Vence")}</dt>
          <dd>{inv.expiresAt.toLocaleDateString(localeOf(lang), { day: "numeric", month: "long", year: "numeric" })}</dd>
        </div>
      </dl>
      <form action={acceptInvitation.bind(null, token)} className="mt-6">
        <button className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border bg-background text-sm font-medium shadow-xs transition-colors hover:bg-muted">
          <GoogleLogo /> {t("Aceptar con Google")}
        </button>
      </form>
      {inv.email && <p className="mt-3 text-center text-xs text-muted-foreground">{t("Entra con la cuenta de Google {email}.", { email: inv.email })}</p>}
    </AuthCard>
  );
}
