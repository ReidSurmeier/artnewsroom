import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide dev indicator in production
  devIndicators: false,

  // Standalone output — produces a minimal self-contained build
  // (~25MB instead of 674MB node_modules)
  output: "standalone",

  serverExternalPackages: ["better-sqlite3"],

  compress: true,

  // Powered-by header leaks tech stack
  poweredByHeader: false,

  // Security + caching headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
      {
        // Cache static assets aggressively (fonts, images)
        source: "/fonts/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // API responses — short cache, stale-while-revalidate
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=10, stale-while-revalidate=60",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
