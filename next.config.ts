import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer"],
  experimental: {
    // Permite subir el logo (hasta 1 MB) desde Configuración
    serverActions: { bodySizeLimit: "2mb" },
  },
  // Incluye el logo de respaldo (public/branding) en las funciones que generan PDFs
  outputFileTracingIncludes: {
    "/api/pdf/**": ["./public/branding/**"],
  },
};

export default nextConfig;
