import type { NextConfig } from "next";

function readBackendOrigin() {
  const raw =
    process.env.GAFFER_BACKEND_ORIGIN ||
    process.env.NEXT_PUBLIC_GAFFER_BACKEND_ORIGIN;

  if (!raw) return null;

  const origin = raw.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(origin)) {
    console.warn(
      `[next.config] Ignoring invalid GAFFER_BACKEND_ORIGIN "${raw}". It must start with http:// or https://.`,
    );
    return null;
  }

  return origin;
}

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  async rewrites() {
    const backendOrigin = readBackendOrigin();
    if (!backendOrigin) return { beforeFiles: [] };
    return {
      beforeFiles: [
        {
          source: "/api/:path*",
          destination: `${backendOrigin}/api/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
