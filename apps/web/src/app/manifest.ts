import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MotiveLife — Your AI life operating system",
    short_name: "MotiveLife",
    description: "Just talk — MotiveLife turns your thoughts into plans, goals, and daily actions.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#050d18",
    theme_color: "#0072ff",
    categories: ["productivity", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.webp", sizes: "192x192", type: "image/webp", purpose: "any" },
      { src: "/icons/icon-512.webp", sizes: "512x512", type: "image/webp", purpose: "any" },
      { src: "/icons/icon-512.webp", sizes: "512x512", type: "image/webp", purpose: "maskable" },
    ],
  };
}
