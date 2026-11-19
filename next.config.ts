import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer"],
  experimental: {
    // Permite subir el logo (hasta 1 MB) desde Configuración
    serverActions: { bodySizeLimit: "4mb" },
  },
  // Archivos que el rastreo de Vercel no detecta solo y que necesitan las funciones que generan PDFs:
  // - el logo de respaldo (public/branding)
  // - las fuentes estándar de pdfkit (Helvetica, etc.), que pdfkit carga con imports internos
  //   `#standard-fonts/*`; sin ellas el PDF falla con "Cannot find module …/Helvetica.cjs"
  outputFileTracingIncludes: {
    "/api/pdf/**": ["./public/branding/**", "./node_modules/pdfkit/js/standard-fonts/**", "./node_modules/pdfkit/js/data/**"],
  },
};

export default nextConfig;
