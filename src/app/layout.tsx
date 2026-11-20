import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { getSessionUser } from "@/lib/current-user";
import { AppSidebar, MobileNav } from "@/components/Sidebar";
import { I18nProvider } from "@/components/I18nProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getLang } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: { default: "Kurier ERP", template: "%s · Kurier ERP" },
  description: "ERP de Kurier Fulfillment",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Sesión, usuario e idioma en paralelo; la página reutiliza el mismo usuario (cache por petición)
  const [me, lang] = await Promise.all([getSessionUser(), getLang()]);
  // Solo los campos que muestra la barra lateral: nunca mandar al navegador el secreto del autenticador
  const user = me ? { name: me.name, email: me.email, image: me.image, role: me.role } : null;
  const signedIn = !!user;

  return (
    <html lang={lang} className={cn("font-sans", geist.variable)}>
      <body className="antialiased">
        <I18nProvider lang={lang}>
          <TooltipProvider delayDuration={200}>
            {signedIn ? (
              <div className="flex min-h-screen">
                <AppSidebar user={user} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <MobileNav user={user} />
                  <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</main>
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
