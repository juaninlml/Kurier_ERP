import Link from "next/link";
import { KeyRound, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/db";
import { ownerEmail } from "@/auth";
import { startOwnerSetup } from "@/app/actions/account";
import { AuthCard } from "@/components/AuthCard";
import { Form } from "@/components/Form";
import { SubmitButton } from "@/components/SubmitButton";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Configurar la cuenta maestra" };

/**
 * Vincula (o vuelve a vincular, si cambiaste de teléfono) el autenticador de la cuenta maestra.
 * Requiere la clave de instalación ERP_SETUP_KEY, que solo conoce quien administra Vercel.
 */
export default async function OwnerSetupPage() {
  const t = await getT();
  const owner = ownerEmail();
  const missing = ["AUTH_SECRET", "ERP_OWNER_EMAIL", "ERP_SETUP_KEY"].filter((k) => !process.env[k]?.trim());
  const enrolled = owner ? !!(await prisma.user.findFirst({ where: { email: owner, NOT: { totpSecret: "" } } })) : false;

  return (
    <AuthCard>
      <div className="mb-3 grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
        <ShieldCheck className="size-5" />
      </div>
      <h1 className="text-lg font-semibold">{enrolled ? t("Volver a vincular la cuenta maestra") : t("Configurar la cuenta maestra")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {enrolled
          ? t("Úsalo si cambiaste de teléfono. El autenticador anterior deja de funcionar al vincular el nuevo.")
          : t("Vincula tu app autenticadora a la cuenta maestra. Después podrás invitar usuarios.")}
      </p>

      {missing.length > 0 ? (
        <div role="alert" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <div className="font-medium">{t("Faltan variables de entorno en el servidor:")}</div>
          <ul className="mt-1 list-disc pl-5 font-mono text-xs">
            {missing.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
          <div className="mt-1 text-xs">{t("Agrégalas en Vercel (Production) y vuelve a hacer deploy.")}</div>
        </div>
      ) : (
        <Form action={startOwnerSetup} className="mt-5 space-y-3">
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            {t("Cuenta maestra")}: <span className="font-medium">{owner}</span>
          </div>
          <label className="block">
            <span className="label">{t("Clave de instalación (ERP_SETUP_KEY)")}</span>
            <input name="setupKey" type="password" required autoComplete="off" className="input" />
          </label>
          <SubmitButton className="btn-primary w-full" pendingText="Verificando…">
            <KeyRound className="size-4" /> {t("Continuar")}
          </SubmitButton>
        </Form>
      )}
      <Link href="/login" className="mt-4 block text-center text-xs text-primary hover:underline">
        {t("Ir a iniciar sesión")}
      </Link>
    </AuthCard>
  );
}
