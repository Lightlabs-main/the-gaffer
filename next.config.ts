import type { NextConfig } from "next";

const backendOrigin =
  process.env.GAFFER_BACKEND_ORIGIN ||
  process.env.NEXT_PUBLIC_GAFFER_BACKEND_ORIGIN;

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  async rewrites() {
    if (!backendOrigin) return { beforeFiles: [] };
    return {
      beforeFiles: [
        {
          source: "/api/:path*",
          destination: `${backendOrigin.replace(/\/+$/, "")}/api/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
