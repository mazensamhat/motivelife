import type { Metadata } from "next";
import { SuitePencilVideosPage } from "@/components/marketing/suite-pencil-videos-page";
import { getSiteUrl } from "@/lib/site-url";

const TITLE = "Product videos — MotiveLife suite";
const DESCRIPTION =
  "Short walkthroughs of DayO, LifeVue, KINZO AI, UPLIFT, Kashu, and VYRA AI — see how each MotiveLife product fits your life.";

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
