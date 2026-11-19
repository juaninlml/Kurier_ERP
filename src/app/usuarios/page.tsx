import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Ban, Link2, ShieldCheck, UserPlus } from "lucide-react";
import { prisma } from "@/lib/db";
import { canManageUsers, getCurrentUser } from "@/lib/current-user";
import { createInvitation, revokeInvitation, updateUser } from "@/app/actions/account";
import { PageHeader, Panel, Empty, Field } from "@/components/kit";
import { Form } from "@/components/Form";
import { SubmitButton } from "@/components/SubmitButton";
import { ConfirmButton } from "@/components/ConfirmButton";
import { CopyButton } from "@/components/CopyButton";
import { Avatar } from "@/components/Sidebar";
import { Badge } from "@/components/ui/badge";
import { getLang, getT } from "@/lib/i18n/server";
import { localeOf } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const metadata = { title: "Usuarios y accesos" };

const ROLE: Record<string, string> = { OWNER: "Cuenta maestra", ADMIN: "Administrador", USER: "Usuario" };

export default async function UsersPage() {
  const me = await getCurrentUser();
  if (!canManageUsers(me.role)) redirect("/");
  const [users, invitations, t, lang, h] = await Promise.all([
    prisma.user.findMany({ orderBy: [{ active: "desc" }, { role: "asc" }, { name: "asc" }] }),
    prisma.invitation.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { createdBy: { select: { name: true, email: true } } } }),
    getT(),
    getLang(),
    headers(),
  ]);
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const now = new Date();
  const fmt = (d: Date) => d.toLocaleDateString(localeOf(lang), { day: "numeric", month: "short", year: "numeric" });
  const statusOf = (i: (typeof invitations)[number]) =>
    i.usedAt ? ["Usada", "bg-emerald-50 text-emerald-700"] : i.revokedAt ? ["Cancelada", "bg-slate-100 text-slate-600"] : i.expiresAt < now ? ["Vencida", "bg-slate-100 text-slate-600"] : ["Pendiente", "bg-amber-50 text-amber-800"];

  return (
    <div>
      <PageHeader title={t("Usuarios y accesos")} subtitle={t("Invita personas con un link. Entran con su cuenta de Google.")} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Panel title={t("Usuarios")} description={t("{n} con acceso activo", { n: users.filter((u) => u.active).length })}>
            <ul className="divide-y">
              {users.map((u) => (
                <li key={u.id} className={u.active ? "" : "opacity-60"}>
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3 hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
                      <Avatar user={u} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">
                          {u.name || u.email} {u.id === me.id && <span className="text-xs font-normal text-muted-foreground">({t("tú")})</span>}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant={u.role === "OWNER" ? "default" : "secondary"}>{t(ROLE[u.role] ?? u.role)}</Badge>
                        <span className="text-[11px] text-muted-foreground">
                          {u.active ? (u.lastLoginAt ? `${t("Último acceso")}: ${fmt(u.lastLoginAt)}` : t("Sin accesos")) : t("Sin acceso")}
                        </span>
                      </div>
                    </summary>
                    {u.role !== "OWNER" && u.id !== me.id && (
                      <Form action={updateUser.bind(null, u.id)} className="flex flex-wrap items-end gap-3 border-t bg-muted/30 px-5 py-4">
                        <Field label={t("Rol")}>
                          <select name="role" defaultValue={u.role} className="input w-48" disabled={u.role === "ADMIN" && me.role !== "OWNER"}>
                            <option value="USER">{t("Usuario")}</option>
                            {me.role === "OWNER" && <option value="ADMIN">{t("Administrador")}</option>}
                            {me.role !== "OWNER" && u.role === "ADMIN" && <option value="ADMIN">{t("Administrador")}</option>}
                          </select>
                        </Field>
                        <label className="flex h-9 items-center gap-2 text-sm">
                          <input type="checkbox" name="active" defaultChecked={u.active} /> {t("Acceso activo")}
                        </label>
                        <SubmitButton className="btn-secondary" pendingText={t("Guardando…")}>
                          {t("Guardar")}
                        </SubmitButton>
                      </Form>
                    )}
                  </details>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title={t("Invitaciones")}>
            {invitations.length === 0 ? (
              <Empty icon={Link2}>{t("Aún no has generado invitaciones.")}</Empty>
            ) : (
              <ul className="divide-y">
                {invitations.map((i) => {
                  const [label, cls] = statusOf(i);
                  const pending = label === "Pendiente";
                  const link = `${origin}/invitacion/${i.token}`;
                  return (
                    <li key={i.id} className="space-y-2 px-5 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium">
                            {i.email || t("Cualquier cuenta de Google")} · {t(ROLE[i.role] ?? i.role)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {i.usedAt
                              ? t("Usada por {email} el {date}", { email: i.usedByEmail, date: fmt(i.usedAt) })
                              : `${t("Vence")} ${fmt(i.expiresAt)} · ${t("creada por {name}", { name: i.createdBy.name || i.createdBy.email })}`}
                            {i.note && ` · ${i.note}`}
                          </div>
                        </div>
                        <Badge variant="outline" className={`border-transparent ${cls}`}>
                          {t(label)}
                        </Badge>
                      </div>
                      {pending && (
                        <div className="flex flex-wrap items-center gap-2">
                          <input readOnly value={link} className="input h-8 min-w-0 flex-1 font-mono text-xs" aria-label={t("Link de invitación")} />
                          <CopyButton value={link} />
                          <Form action={revokeInvitation.bind(null, i.id)}>
                            <ConfirmButton message={t("¿Cancelar esta invitación? El link dejará de funcionar.")} className="btn-danger h-8 text-xs">
                              <Ban className="size-3.5" /> {t("Cancelar")}
                            </ConfirmButton>
                          </Form>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>

        <Panel title={t("Nueva invitación")} description={t("Se genera un link para compartir por WhatsApp o correo.")} className="h-fit xl:sticky xl:top-6">
          <Form action={createInvitation} resetOnSuccess className="space-y-3 p-5">
            <Field label={t("Correo (opcional)")} hint={t("Si lo indicas, solo esa cuenta de Google podrá usar el link.")}>
              <input name="email" type="email" className="input" placeholder="nombre@empresa.com" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("Rol")}>
                <select name="role" defaultValue="USER" className="input">
                  <option value="USER">{t("Usuario")}</option>
                  {me.role === "OWNER" && <option value="ADMIN">{t("Administrador")}</option>}
                </select>
              </Field>
              <Field label={t("Vence en (días)")}>
                <input name="days" type="number" min="1" max="30" defaultValue={7} className="input text-right" />
              </Field>
            </div>
            <Field label={t("Nota (opcional)")}>
              <input name="note" className="input" placeholder={t("Ej. auxiliar de facturación")} />
            </Field>
            <SubmitButton className="btn-primary w-full" pendingText={t("Generando…")}>
              <UserPlus className="size-4" /> {t("Generar link")}
            </SubmitButton>
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
              {t("Los administradores pueden invitar usuarios. Solo la cuenta maestra puede crear administradores.")}
            </p>
          </Form>
        </Panel>
      </div>
    </div>
  );
}
