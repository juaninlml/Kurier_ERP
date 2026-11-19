import { getT } from "@/lib/i18n/server";
import { LanguageSwitch } from "./LanguageSwitch";

/** Marco de las páginas públicas (login e invitación). */
export async function AuthCard({ children }: { children: React.ReactNode }) {
  const t = await getT();
  return (
    <div className="relative grid min-h-screen place-items-center bg-sidebar px-4 py-10">
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

/** Logo de Google para el botón de acceso. */
export function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
