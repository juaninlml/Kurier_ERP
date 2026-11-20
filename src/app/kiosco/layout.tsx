import type { Metadata, Viewport } from "next";
import { KioskShell } from "@/components/KioskShell";

/** El kiosco se instala como app (pantalla completa, sin barra del navegador). */
export const metadata: Metadata = {
  manifest: "/branding/kiosco.webmanifest",
  applicationName: "Kiosco Kurier",
  appleWebApp: { capable: true, title: "Kiosco Kurier", statusBarStyle: "black-translucent" },
  icons: { icon: "/branding/kiosco-192.png", apple: "/branding/kiosco-apple-180.png" },
  formatDetection: { telephone: false },
  // iPads con iPadOS anterior a 16.4 solo abren sin barra de Safari con esta etiqueta
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: "#163a5c",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return <KioskShell>{children}</KioskShell>;
}
