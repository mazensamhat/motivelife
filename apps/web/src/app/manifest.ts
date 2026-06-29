import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "motivelife.ai — Your AI Partner for a Better Life",
    short_name: "motivelife.ai",
    description: "Help every person make better life decisions every day.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#050d18",
    theme_color: "#0072ff",
    categories: ["productivity", "lifestyle"],
    icons: [
      {
        src: "/brand/logo-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/brand/logo-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
