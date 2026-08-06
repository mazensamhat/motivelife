import type { Metadata } from "next";
import { FamilyMapPublicPreview } from "@/components/family/family-map-public-preview";

export const metadata: Metadata = {
  title: "Family Map preview · MyMotiveFamily",
  description:
    "Public no-login preview of the redesigned Family Map — sample pins, bottom people sheet, Family Brief.",
  robots: { index: false, follow: false },
};

export default function FamilyMapPreviewPage() {
  return <FamilyMapPublicPreview />;
}
