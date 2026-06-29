import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@forward/database", "@forward/shared", "@forward/ai"],
  serverExternalPackages: ["@prisma/client", "stripe"],
  headers: async () => [
    {
      source: "/sw.js",
      headers: [
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        { key: "Service-Worker-Allowed", value: "/" },
      ],
    },
  ],
};

export default nextConfig;