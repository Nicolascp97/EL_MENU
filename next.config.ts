import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false, // no exponer versión de Next.js en cabeceras HTTP
  // Anclar el root de Turbopack a este directorio. Sin esto Next detecta
  // un package-lock.json huérfano en C:\Users\Nicolas CP\ y elige ese
  // directorio como workspace root, rompiendo resoluciones de módulos.
  // Next compila este archivo a CJS, por lo que __dirname está disponible.
  turbopack: {
    root: __dirname,
  },
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // Permitir imágenes servidas desde Supabase Storage del proyecto.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'xneydkfzcveigmbtpltk.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
