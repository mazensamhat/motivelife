import type { Metadata } from "next";
import { SuitePencilVideosPage } from "@/components/marketing/suite-pencil-videos-page";
import { getSiteUrl } from "@/lib/site-url";

const TITLE = "Pencil stories — MotiveLife suite videos";
const DESCRIPTION =
  "Watch ~45-second pencil-sketch stories for DayO, LifeVue, KINZO AI, UPLIFT, Kashu, and VYRA AI — deep narration, no stock humans.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "MotiveLife videos",
    "Kashu",
    "KINZO",
    "DayO",
    "LifeVue",
    "UPLIFT",
    "VYRA",
    "pencil sketch",
    "product demo",
  ],
  alternates: { canonical: "/videos" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${getSiteUrl()}/videos`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function VideosPage() {
  return <SuitePencilVideosPage />;
}
