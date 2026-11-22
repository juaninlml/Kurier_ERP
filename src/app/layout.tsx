import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist } from "next/font/google";
import "./globals.css";
import { getSessionUser } from "@/lib/current-user";
import { AppSidebar, MobileNav } from "@/components/Sidebar";
import { I18nProvider } from "@/components/I18nProvider";
import { PageTransition } from "@/components/PageTransition";
import { ArrivalCurtain } from "@/components/SessionCurtain";
import { ARRIVE_COOKIE } from "@/lib/session-ui";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getLang } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";
import { isTheme, THEME_COOKIE, THEME_SCRIPT, VIEW_TRANSITION_GUARD } from "@/lib/theme";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: { default: "Kurier ERP", template: "%s · Kurier ERP" },
  description: "ERP de Kurier Fulfillment",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Sesión, usuario e idioma en paralelo; la página reutiliza el mismo usuario (cache por petición)
  const [me, lang, jar] = await Promise.all([getSessionUser(), getLang(), cookies()]);
  const c = jar.get(THEME_COOKIE)?.value;
  const theme = isTheme(c) ? c : "light";
  // Solo los campos que muestra la barra lateral: nunca mandar al navegador el secreto del autenticador
  const user = me ? { name: me.name, email: me.email, image: me.image, role: me.role } : null;
  const signedIn = !!user;
  const arriving = signedIn && jar.get(ARRIVE_COOKIE)?.value === "1";

  return (
    // La clase "dark" sale del servidor si el tema es oscuro; con "sistema" la pone el script antes de pintar
    <html lang={lang} className={cn("font-sans", geist.variable, theme === "dark" && "dark")} style={{ colorScheme: theme === "dark" ? "dark" : undefined }} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT + VIEW_TRANSITION_GUARD }} />
      </head>
      <body className="antialiased">
        <I18nProvider lang={lang} theme={theme}>
          <TooltipProvider delayDuration={200}>
            {signedIn ? (
              <div className="flex min-h-screen">
                <ArrivalCurtain initial={arriving} />
                <AppSidebar user={user} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <MobileNav user={user} />
                  <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
                    {/* Transición suave al cambiar de sección (solo el contenido; la barra lateral queda fija) */}
                    <PageTransition>{children}</PageTransition>
                  </main>
                </div>
              </div>
            ) : (
              <main className="min-h-screen">{children}</main>
            )}
          </TooltipProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
