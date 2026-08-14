import type { Metadata } from "next";
import { FamilyIntelPreviewMock } from "@/components/family/family-intel-preview-mock";

export const metadata: Metadata = {
  title: "Family Brief preview · KINZO AI",
  description:
    "Visual mock of the proposed Family Intelligence brief under the map — for founder review.",
  robots: { index: false, follow: false },
};

export default function FamilyIntelPreviewPage() {
  return <FamilyIntelPreviewMock />;
}
