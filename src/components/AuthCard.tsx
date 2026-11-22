import { LanguageSwitch } from "./LanguageSwitch";
import { KidoLogo } from "./KidoLogo";

/** Marco de las páginas públicas (login e invitación). */
export function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-sidebar px-4 py-10">
      <div className="absolute top-4 right-4">
        <LanguageSwitch dark />
      </div>
      <div className="w-full max-w-sm">
        <KidoLogo className="auth-enter mb-7" />
        <div className="auth-enter-late rounded-2xl bg-card p-7 text-card-foreground shadow-xl">{children}</div>
      </div>
    </div>
  );
}
