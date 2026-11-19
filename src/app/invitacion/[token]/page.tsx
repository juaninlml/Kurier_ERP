import Link from "next/link";
import { MailCheck, ShieldCheck, Smartphone, TriangleAlert } from "lucide-react";
import { prisma } from "@/lib/db";
import { confirmEnrollment, setInvitationIdentity } from "@/app/actions/account";
import { AuthCard } from "@/components/AuthCard";
import { Form } from "@/components/Form";
import { SubmitButton } from "@/components/SubmitButton";
import { decryptSecret, encryptSecret, formatSecret, newSecret, otpauthUri, qrSvg } from "@/lib/totp";
import { getLang, getT } from "@/lib/i18n/server";
import { localeOf } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vincular autenticador" };

const ROLE: Record<string, string> = { OWNER: "Cuenta maestra", ADMIN: "Administrador", USER: "Usuario" };

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [found, t, lang] = await Promise.all([
    prisma.invitation.findUnique({ where: { token }, include: { createdBy: { select: { name: true, email: true } } } }),
    getT(),
    getLang(),
  ]);
  let inv = found;
  const valid = inv && !inv.usedAt && !inv.revokedAt && inv.expiresAt > new Date();

  if (!inv || !valid) {
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

  const title = inv.kind === "RESET" ? t("Vincular un teléfono nuevo") : inv.kind === "OWNER" ? t("Configurar la cuenta maestra") : t("Te invitaron a Kurier ERP");
  const who = inv.createdBy?.name || inv.createdBy?.email;
  const expires = inv.expiresAt.toLocaleString(localeOf(lang), { dateStyle: "medium", timeStyle: "short" });

  // Paso 1 (solo invitaciones sin correo): nombre y correo
  if (!inv.email) {
    return (
      <AuthCard>
        <div className="mb-3 grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
          <MailCheck className="size-5" />
        </div>
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {who ? t("{name} te dio acceso como {role}.", { name: who, role: t(ROLE[inv.role] ?? inv.role) }) : null} {t("Primero escribe tus datos.")}
        </p>
        <Form action={setInvitationIdentity.bind(null, token)} className="mt-5 space-y-3">
          <label className="block">
            <span className="label">{t("Nombre")}</span>
            <input name="name" required className="input" autoComplete="name" />
          </label>
          <label className="block">
            <span className="label">{t("Correo")}</span>
            <input name="email" type="email" required className="input" autoComplete="email" />
          </label>
          <SubmitButton className="btn-primary w-full">{t("Continuar")}</SubmitButton>
        </Form>
      </AuthCard>
    );
  }

  // Paso 2: QR para la app autenticadora (el secreto se genera una vez y se guarda cifrado mientras se confirma)
  if (!inv.pendingSecret) {
    inv = await prisma.invitation.update({ where: { id: inv.id }, data: { pendingSecret: encryptSecret(newSecret()) }, include: { createdBy: { select: { name: true, email: true } } } });
  }
  const secret = decryptSecret(inv.pendingSecret);
  const svg = await qrSvg(otpauthUri(inv.email, secret));

  return (
    <AuthCard>
      <div className="mb-3 grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
        {inv.kind === "INVITE" ? <MailCheck className="size-5" /> : <ShieldCheck className="size-5" />}
      </div>
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {inv.kind === "INVITE" && who ? `${t("{name} te dio acceso como {role}.", { name: who, role: t(ROLE[inv.role] ?? inv.role) })} ` : ""}
        {t("Cuenta")}: <span className="font-medium text-foreground">{inv.email}</span>
      </p>

      <ol className="mt-4 space-y-1.5 text-sm">
        <li>
          <span className="font-semibold">1.</span> {t("Instala una app autenticadora: Google Authenticator, Microsoft Authenticator o Authy.")}
        </li>
        <li>
          <span className="font-semibold">2.</span> {t("En la app toca «+» y escanea este código QR.")}
        </li>
      </ol>
      <div className="mt-3 flex justify-center rounded-xl border bg-white p-3">
        <div className="size-[220px] [&>svg]:size-full" aria-label={t("Código QR para la app autenticadora")} role="img" dangerouslySetInnerHTML={{ __html: svg }} />
      </div>
      <details className="mt-2 text-center text-xs text-muted-foreground">
        <summary className="cursor-pointer hover:text-foreground">{t("¿No puedes escanear? Escribe la clave a mano")}</summary>
        <code className="mt-2 block rounded-md bg-muted px-2 py-1.5 font-mono text-[13px] tracking-wider break-all text-foreground select-all">{formatSecret(secret)}</code>
        <span className="mt-1 block">{t("Tipo: basada en tiempo · 6 dígitos")}</span>
      </details>

      <Form action={confirmEnrollment.bind(null, token)} className="mt-4 space-y-3">
        <p className="text-sm">
          <span className="font-semibold">3.</span> {t("Escribe el código de 6 dígitos que muestra la app.")}
        </p>
        {inv.kind !== "RESET" && !inv.name && (
          <label className="block">
            <span className="label">{t("Nombre")}</span>
            <input name="name" className="input" autoComplete="name" />
          </label>
        )}
        <input
          name="code"
          required
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]{6,7}"
          maxLength={7}
          aria-label={t("Código del autenticador")}
          className="input h-12 text-center font-mono text-2xl tracking-[0.4em]"
          placeholder="000000"
        />
        <SubmitButton className="btn-primary h-10 w-full" pendingText="Verificando…">
          <Smartphone className="size-4" /> {t("Vincular y continuar")}
        </SubmitButton>
      </Form>
      <p className="mt-3 text-center text-xs text-muted-foreground">{t("Este link vence el {date}.", { date: expires })}</p>
    </AuthCard>
  );
}
