import { getT } from "@/lib/i18n/server";
import { LanguageSwitch } from "./LanguageSwitch";

/** Marco de las páginas públicas (login e invitación). */
export async function AuthCard({ children }: { children: React.ReactNode }) {
  const t = await getT();
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-sidebar px-4 py-10">
      <div className="absolute top-4 right-4">
        <LanguageSwitch dark />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-3 text-sidebar-foreground">
          <div className="grid size-11 place-items-center rounded-xl bg-sidebar-primary text-lg font-bold text-sidebar-primary-foreground shadow-sm">K</div>
          <div className="leading-tight">
            <div className="text-lg font-semibold">Kurier ERP</div>
            <div className="text-xs text-sidebar-foreground/60">{t("Fulfillment · CDMX")}</div>
          </div>
        </div>
        <div className="rounded-2xl bg-card p-7 text-card-foreground shadow-xl">{children}</div>
      </div>
    </div>
  );
}
