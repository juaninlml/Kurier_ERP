import { LogOut, PartyPopper } from "lucide-react";
import { getCurrentUser } from "@/lib/current-user";
import { signOutAction, updateProfile } from "@/app/actions/account";
import { PageHeader, Panel, Field } from "@/components/kit";
import { Form } from "@/components/Form";
import { SubmitButton } from "@/components/SubmitButton";
import { Avatar } from "@/components/Sidebar";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getLang, getT } from "@/lib/i18n/server";
import { localeOf } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mi perfil" };

const ROLE: Record<string, string> = { OWNER: "Cuenta maestra", ADMIN: "Administrador", USER: "Usuario" };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ bienvenida?: string }> }) {
  const [{ bienvenida }, user, t, lang] = await Promise.all([searchParams, getCurrentUser(), getT(), getLang()]);
  const fmt = (d: Date | null) => (d ? d.toLocaleString(localeOf(lang), { dateStyle: "medium", timeStyle: "short" }) : "—");

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("Mi perfil")} subtitle={t("Tus datos y preferencias en Kurier ERP.")} />

      {bienvenida && (
        <Alert className="mb-6 border-emerald-200 bg-emerald-50 text-emerald-900">
          <PartyPopper />
          <AlertTitle>{t("¡Bienvenido a Kurier ERP!")}</AlertTitle>
          <AlertDescription className="text-emerald-900/80">{t("Tu acceso quedó activo. Completa tu perfil y elige tu idioma.")}</AlertDescription>
        </Alert>
      )}

      <Panel className="mb-6" bodyClassName="flex flex-wrap items-center gap-4 p-5">
        <Avatar user={{ name: user.name, email: user.email, image: user.image }} className="size-16 text-lg" />
        <div className="min-w-0 flex-1">
          <div className="text-lg font-semibold">{user.name || user.email}</div>
          <div className="text-sm text-muted-foreground">{user.email}</div>
          <div className="mt-1.5 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">{t(ROLE[user.role] ?? user.role)}</Badge>
            <span>
              {t("Último acceso")}: {fmt(user.lastLoginAt)}
            </span>
          </div>
        </div>
        <form action={signOutAction}>
          <button className="btn-secondary">
            <LogOut className="size-4" /> {t("Cerrar sesión")}
          </button>
        </form>
      </Panel>

      <Panel title={t("Datos del perfil")} description={t("Tu correo es tu usuario para iniciar sesión.")}>
        <Form action={updateProfile} className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("Nombre")}>
              <input name="name" defaultValue={user.name} className="input" />
            </Field>
            <Field label={t("Correo")}>
              <input value={user.email} disabled className="input" readOnly />
            </Field>
            <Field label={t("Puesto")}>
              <input name="position" defaultValue={user.position} className="input" />
            </Field>
            <Field label={t("Teléfono")}>
              <input name="phone" defaultValue={user.phone} className="input" />
            </Field>
            <Field label={t("Idioma")}>
              <select name="locale" defaultValue={lang} className="input">
                <option value="es">Español</option>
                <option value="en">English</option>
              </select>
            </Field>
          </div>
          <div className="flex justify-end">
            <SubmitButton pendingText={t("Guardando…")}>{t("Guardar perfil")}</SubmitButton>
          </div>
        </Form>
      </Panel>
    </div>
  );
}
