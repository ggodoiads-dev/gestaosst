import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
