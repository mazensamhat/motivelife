export declare const PRODUCT_FEEDBACK_KINDS: readonly ["wish", "change", "praise", "bug"];
export type ProductFeedbackKind = (typeof PRODUCT_FEEDBACK_KINDS)[number];
export declare const PRODUCT_FEEDBACK_KIND_LABELS: Record<ProductFeedbackKind, string>;
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
