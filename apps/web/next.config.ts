import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../.."),
  outputFileTracingIncludes: {
    "/api/admin/marketing/posts/[id]/creative": [
      "../../node_modules/ffmpeg-static/**",
      "../../node_modules/.pnpm/ffmpeg-static@*/node_modules/ffmpeg-static/**",
    ],
  },
  transpilePackages: ["@forward/database", "@forward/shared", "@forward/ai", "@forward/marketing-agent"],
  serverExternalPackages: ["@prisma/client", "stripe", "sharp"],
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