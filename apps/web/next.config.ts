import path from "node:path";
import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  // The workspace root, so the standalone build includes packages/*.
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  // Migrations are read from disk at startup.
  outputFileTracingIncludes: { "/**": ["./drizzle/**/*"] },
  poweredByHeader: false,
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default config;
