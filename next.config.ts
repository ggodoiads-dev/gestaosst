import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Padrão do Next é 1 MB: importações de planilha (e fotos) estouravam. O limite da Vercel é 4,5 MB por requisição.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  // Cabeçalhos de segurança em todas as respostas. A câmera continua liberada só pro próprio site (foto do checklist).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
          // Ninguém pode embutir o SIGO em outro site (clickjacking), nem trocar a base dos links ou o destino dos formulários.
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.sigo.log.br" }],
        destination: "https://sigo.log.br/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
