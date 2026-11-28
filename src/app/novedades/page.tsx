import { getCurrentUser } from "@/lib/current-user";
import { PageHeader, Panel } from "@/components/kit";
import { ChangelogList } from "@/components/WhatsNew";
import { CHANGELOG, localizeChangelog } from "@/lib/changelog";
import { getLang, getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await getT())("Novedades") };
}

/** Historial completo de novedades del ERP (la ventana al entrar solo muestra las que no has visto). */
export default async function ChangelogPage() {
  const [, t, lang] = await Promise.all([getCurrentUser(), getT(), getLang()]);
  const entries = localizeChangelog([...CHANGELOG].sort((a, b) => b.id.localeCompare(a.id)), lang);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("Novedades")} subtitle={t("Funciones nuevas, mejoras y correcciones de Kurier ERP.")} />
      <Panel bodyClassName="p-5">
        <ChangelogList entries={entries} />
      </Panel>
    </div>
  );
}
