import type { NextConfig } from "next";

/**
 * Cabeceras de seguridad para todas las respuestas. La Content-Security-Policy no va aquí:
 * lleva un nonce distinto en cada petición y la pone el proxy (src/proxy.ts).
 */
const SECURITY_HEADERS = [
  // Solo HTTPS durante 2 años (Vercel ya sirve todo por HTTPS; el navegador deja de intentar HTTP)
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // Nadie puede meter el ERP en un iframe (clickjacking); equivale a frame-ancestors 'none' de la CSP
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // El kiosco usa pantalla completa y wake lock; la app de reparto usa la cámara (escanear guías y foto de entrega)
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), browsing-topics=(), fullscreen=(self), screen-wake-lock=(self)",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  serverExternalPackages: ["@react-pdf/renderer"],
  experimental: {
    // Permite subir el logo (hasta 1 MB) desde Configuración
    serverActions: { bodySizeLimit: "4mb" },
  },
  // Archivos que el rastreo de Vercel no detecta solo y que necesitan las funciones que generan PDFs:
  // - el logo de respaldo (public/branding)
  // - las fuentes estándar de pdfkit (Helvetica, etc.), que pdfkit carga con imports internos
  //   `#standard-fonts/*`; sin ellas el PDF falla con "Cannot find module …/Helvetica.cjs"
  // - la fuente Noto Sans SC de los PDFs en chino (src/pdf/fonts; se lee del disco al generar el PDF)
  // Se incluyen en TODAS las rutas: además de /api/pdf, el archivo en Google Drive genera PDFs desde
  // las acciones de facturas, cotizaciones, nómina y desde Configuración ("Subir pendientes").
  outputFileTracingIncludes: {
    "/**": ["./public/branding/**", "./node_modules/pdfkit/js/standard-fonts/**", "./node_modules/pdfkit/js/data/**", "./src/pdf/fonts/**"],
  },
};

export default nextConfig;
