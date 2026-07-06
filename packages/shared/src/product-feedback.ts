export const PRODUCT_FEEDBACK_KINDS = ["wish", "change", "praise", "bug"] as const;

export type ProductFeedbackKind = (typeof PRODUCT_FEEDBACK_KINDS)[number];

export const PRODUCT_FEEDBACK_KIND_LABELS: Record<ProductFeedbackKind, string> = {
  wish: "I'd love to see…",
  change: "Please change…",
  praise: "What's working well",
  bug: "Something isn't working",
};

export type ViewportTier = "mobile" | "tablet" | "desktop";

export interface ProductFeedbackPayload {
  id: string;
  kind: ProductFeedbackKind;
  message: string;
  pagePath: string | null;
  viewport: ViewportTier | null;
  status: string;
  createdAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
}
