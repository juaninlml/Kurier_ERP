import { redirect } from "next/navigation";
import { CircleAlert } from "lucide-react";
import { auth } from "@/auth";
import { devLoginEnabled } from "@/auth.config";
import { devSignIn, signInWithGoogle } from "@/app/actions/account";
import { AuthCard, GoogleLogo } from "@/components/AuthCard";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Iniciar sesión" };

const ERRORS: Record<string, string> = {
  NoAccess: "Tu cuenta de Google no tiene acceso. Pide un link de invitación al administrador.",
  AccessDenied: "Tu cuenta de Google no tiene acceso. Pide un link de invitación al administrador.",
  InviteInvalid: "El link de invitación ya se usó, venció o fue cancelado. Pide uno nuevo.",
  InviteEmail: "Esta invitación es para otro correo. Entra con la cuenta de Google a la que se envió.",
  Configuration: "El inicio de sesión no está configurado. Revisa las variables AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET y AUTH_SECRET.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; callbackUrl?: string }> }) {
  const { error, callbackUrl } = await searchParams;
  if ((await auth())?.user) redirect("/");
  const t = await getT();
  const message = error ? (ERRORS[error] ?? "No se pudo iniciar sesión. Intenta de nuevo.") : null;
  // Solo rutas internas (evita redirecciones a otros sitios)
  let next = "/";
  try {
    const u = new URL(callbackUrl ?? "/", "http://x");
    if (u.origin === "http://x" || callbackUrl?.startsWith("http")) next = u.pathname + u.search;
  } catch {
    next = "/";
  }

  return (
    <AuthCard>
      <h1 className="text-xl font-semibold tracking-tight">{t("Iniciar sesión")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("Entra con tu cuenta de Google autorizada.")}</p>
      {message && (
        <div role="alert" className="mt-4 flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          {t(message)}
        </div>
      )}
      <form action={signInWithGoogle} className="mt-6">
        <input type="hidden" name="next" value={next.startsWith("/") && !next.startsWith("//") ? next : "/"} />
        <button className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border bg-background text-sm font-medium shadow-xs transition-colors hover:bg-muted">
          <GoogleLogo /> {t("Continuar con Google")}
        </button>
      </form>
      {devLoginEnabled && (
        <form action={devSignIn} className="mt-6 space-y-2 border-t pt-4">
          <p className="text-xs text-amber-700">Solo desarrollo local: entrar sin Google.</p>
          <input name="email" type="email" required placeholder="correo@ejemplo.com" className="input" />
          <button className="btn-secondary w-full">Entrar (desarrollo)</button>
        </form>
      )}
      <p className="mt-6 text-center text-xs text-muted-foreground">{t("El acceso es solo por invitación.")}</p>
    </AuthCard>
  );
}
