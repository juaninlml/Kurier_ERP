import Link from "next/link";
import { redirect } from "next/navigation";
import { CircleCheck, KeyRound, Smartphone } from "lucide-react";
import { auth } from "@/auth";
import { login } from "@/app/actions/account";
import { AuthCard } from "@/components/AuthCard";
import { Form } from "@/components/Form";
import { SubmitButton } from "@/components/SubmitButton";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Iniciar sesión" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string; vinculado?: string; email?: string }> }) {
  const { callbackUrl, vinculado, email } = await searchParams;
  if ((await auth())?.user) redirect("/");
  const t = await getT();
  // Solo rutas internas (evita redirigir a otros sitios)
  let next = "/";
  try {
    const u = new URL(callbackUrl ?? "/", "http://x");
    next = u.pathname + u.search;
  } catch {
    next = "/";
  }
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/login")) next = "/";
  // Diagnóstico: nombres (nunca valores) de las variables que faltan en el servidor
  const missingEnv = ["AUTH_SECRET", "ERP_OWNER_EMAIL"].filter((k) => !process.env[k]?.trim());

  return (
    <AuthCard>
      <h1 className="text-xl font-semibold tracking-tight">{t("Iniciar sesión")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("Escribe tu correo y el código de 6 dígitos de tu app autenticadora.")}</p>

      {vinculado && (
        <div role="status" className="mt-4 flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <CircleCheck className="mt-0.5 size-4 shrink-0" />
          {t("Tu autenticador quedó vinculado. Entra con el siguiente código que muestre la app.")}
        </div>
      )}
      {missingEnv.length > 0 && (
        <div role="alert" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <div className="font-medium">{t("Faltan variables de entorno en el servidor:")}</div>
          <ul className="mt-1 list-disc pl-5 font-mono text-xs">
            {missingEnv.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
          <div className="mt-1 text-xs">{t("Agrégalas en Vercel (Production) y vuelve a hacer deploy.")}</div>
        </div>
      )}

      <Form action={login} className="mt-5 space-y-4">
        <input type="hidden" name="next" value={next} />
        <label className="block">
          <span className="label">{t("Correo")}</span>
          <input name="email" type="email" required autoComplete="username" defaultValue={email ?? ""} className="input" placeholder="nombre@empresa.com" />
        </label>
        <label className="block">
          <span className="label flex items-center gap-1.5">
            <Smartphone className="size-3.5" /> {t("Código del autenticador")}
          </span>
          <input
            name="code"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            autoFocus={!!email}
            className="input h-12 text-center font-mono text-2xl tracking-[0.4em]"
            placeholder="000000"
          />
        </label>
        <SubmitButton className="btn-primary h-10 w-full" pendingText="Verificando…">
          <KeyRound className="size-4" /> {t("Entrar")}
        </SubmitButton>
      </Form>

      <div className="mt-6 space-y-1 text-center text-xs text-muted-foreground">
        <p>{t("El acceso es solo por invitación.")}</p>
        <p>
          {t("¿Cambiaste de teléfono? Pide al administrador un link para restablecer tu autenticador.")}{" "}
          <Link href="/configurar-acceso" className="text-primary hover:underline">
            {t("Cuenta maestra")}
          </Link>
        </p>
      </div>
    </AuthCard>
  );
}
