import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Padrão do Next é 1 MB: importações de planilha (e fotos) estouravam. O limite da Vercel é 4,5 MB por requisição.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
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
