import type { Metadata } from "next";
import { FamilyMapVisualPreview } from "@/components/family/family-map-visual-preview";

export const metadata: Metadata = {
  title: "Family Map visual preview · MyMotiveFamily",
  description:
    "Map-first visual mock with people strip and bottom details — founder preview only.",
  robots: { index: false, follow: false },
};

export default function FamilyMapVisualPreviewPage() {
  return <FamilyMapVisualPreview />;
}
