/**
 * Homepage-only visual system. Do not use these colors for in-app chrome —
 * PRODUCT_SUITE remains the product identity inside the authenticated app.
 */
export const ML_PALETTE = {
  bg: "#070B14",
  surface: "#0D1420",
  raised: "#121C2B",
  text: "#F7F9FC",
  muted: "#98A5B7",
} as const;

/** Module colours as identifiers — accent a number, not a whole card. */
export const MARKETING_MODULE_COLOR = {
  dayo: "#60A5FA",
  kashu: "#A3E635",
  vitalu: "#2DD4BF",
  kinzo: "#FB923C",
  uplift: "#C084FC",
  vyra: "#A78BFA",
  lifevue: "#67E8F9",
} as const;

export type MarketingModuleId = keyof typeof MARKETING_MODULE_COLOR;

export const LIFE_OS_ORBIT = [
  { id: "dayo" as const, domain: "TODAY", href: "/#products" },
  { id: "kashu" as const, domain: "MONEY", href: "/cash-flow" },
  { id: "vitalu" as const, domain: "HEALTH", href: "/wellness" },
  { id: "kinzo" as const, domain: "FAMILY", href: "/family" },
  { id: "uplift" as const, domain: "GOALS", href: "/#products" },
  { id: "lifevue" as const, domain: "YOU", href: "/#dashboard" },
] as const;
