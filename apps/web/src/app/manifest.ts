import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MotiveLife — AI life operating system",
    short_name: "MotiveLife",
    description:
      "DayO, LifeVue, Kashu Safe to Spend, UPLIFT, VYRA & KINZO — your Digital Twin life OS.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#050d18",
    theme_color: "#050d18",
    categories: ["productivity", "lifestyle", "finance"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-192.webp", sizes: "192x192", type: "image/webp", purpose: "any" },
      { src: "/icons/icon-512.webp", sizes: "512x512", type: "image/webp", purpose: "any" },
    ],
  };
}
