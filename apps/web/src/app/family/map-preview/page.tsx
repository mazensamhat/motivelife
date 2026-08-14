import type { Metadata } from "next";
import { FamilyMapPublicPreview } from "@/components/family/family-map-public-preview";

export const metadata: Metadata = {
  title: "KINZO map preview · KINZO AI",
  description:
    "Public no-login preview of the redesigned KINZO map — sample pins, bottom people sheet, Family Brief.",
  robots: { index: false, follow: false },
};

export default function FamilyMapPreviewPage() {
  return <FamilyMapPublicPreview />;
}
