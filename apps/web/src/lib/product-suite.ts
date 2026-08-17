/**
 * MotiveLife.ai product suite — display names, taglines, and accent colors.
 * Routes stay stable; only chrome labels / icons change.
 */

export type ProductSuiteId =
  | "dayo"
  | "lifevue"
  | "kinzo"
  | "uplift"
  | "vyra"
  | "kashu"
  | "motiveiq"
  | "signals"
  | "connect"
  | "settings";

export type ProductSuiteDef = {
  id: ProductSuiteId;
  /** Primary chrome label */
  label: string;
  /** Short label for bottom tabs */
  shortLabel: string;
  tagline: string;
  /** Glow / accent */
  primary: string;
  primaryLight: string;
  primaryDark: string;
};

export const PRODUCT_SUITE: Record<ProductSuiteId, ProductSuiteDef> = {
  dayo: {
    id: "dayo",
    label: "DayO",
    shortLabel: "DayO",
    tagline: "Your day",
    primary: "#F97316",
    primaryLight: "#FDBA74",
    primaryDark: "#EA580C",
  },
  lifevue: {
    id: "lifevue",
    label: "LifeVue",
    shortLabel: "LifeVue",
    tagline: "Your life in one view",
    primary: "#06B6D4",
    primaryLight: "#67E8F9",
    primaryDark: "#0E7490",
  },
  kinzo: {
    id: "kinzo",
    label: "KINZO AI",
    shortLabel: "KINZO",
    tagline: "Family intelligence in motion",
    primary: "#8B5CF6",
    primaryLight: "#C4B5FD",
    primaryDark: "#6D28D9",
  },
  uplift: {
    id: "uplift",
    label: "UPLIFT",
    shortLabel: "UPLIFT",
    tagline: "Your goals, elevated",
    primary: "#F59E0B",
    primaryLight: "#FCD34D",
    primaryDark: "#D97706",
  },
  vyra: {
    id: "vyra",
    label: "VYRA AI",
    shortLabel: "VYRA",
    tagline: "Chief of Staff — synthesizes specialists",
    primary: "#A855F7",
    primaryLight: "#D8B4FE",
    primaryDark: "#7E22CE",
  },
  kashu: {
    id: "kashu",
    label: "Kashu",
    shortLabel: "Kashu",
    tagline: "Know what's safe before you spend",
    primary: "#10B981",
    primaryLight: "#6EE7B7",
    primaryDark: "#0F766E",
  },
  motiveiq: {
    id: "motiveiq",
    label: "MotiveIQ",
    shortLabel: "MotiveIQ",
    tagline: "Patterns, memory & insights",
    primary: "#22D3EE",
    primaryLight: "#A5F3FC",
    primaryDark: "#0891B2",
  },
  signals: {
    id: "signals",
    label: "Signals",
    shortLabel: "Signals",
    tagline: "What your AI noticed",
    primary: "#3B82F6",
    primaryLight: "#93C5FD",
    primaryDark: "#1D4ED8",
  },
  connect: {
    id: "connect",
    label: "Connect",
    shortLabel: "Connect",
    tagline: "Apps, devices & services",
    primary: "#14B8A6",
    primaryLight: "#5EEAD4",
    primaryDark: "#0F766E",
  },
  settings: {
    id: "settings",
    label: "Settings",
    shortLabel: "Settings",
    tagline: "Preferences & privacy",
    primary: "#8B5CF6",
    primaryLight: "#C4B5FD",
    primaryDark: "#6D28D9",
  },
};

/** Map nav icon keys → suite product (for accent + custom glyph). */
export const NAV_TO_PRODUCT: Partial<
  Record<
    | "home"
    | "life_hub"
    | "family"
    | "goals"
    | "ai"
    | "kashu"
    | "money"
    | "intelligence"
    | "memory"
    | "feed"
    | "connect"
    | "settings"
    | "more",
    ProductSuiteId
  >
> = {
  home: "dayo",
  life_hub: "lifevue",
  family: "kinzo",
  goals: "uplift",
  ai: "vyra",
  kashu: "kashu",
  money: "kashu",
  intelligence: "motiveiq",
  memory: "motiveiq",
  feed: "signals",
  connect: "connect",
  settings: "settings",
  more: "settings",
};

/** Homepage / marketing suite cards (MotiveLife parent brand stays the logo). */
export const MARKETING_SUITE_PRODUCTS: Array<{
  id: ProductSuiteId;
  href: string;
  blurb: string;
}> = [
  {
    id: "dayo",
    href: "/#features",
    blurb: "Your day, briefed and ready — morning mission without the noise.",
  },
  {
    id: "lifevue",
    href: "/#digital-twin",
    blurb: "Your life in one view — Digital Twin signals across money, health, and time.",
  },
  {
    id: "kinzo",
    href: "/family",
    blurb: "Family intelligence in motion — live map, routines, and calm alerts.",
  },
  {
    id: "uplift",
    href: "/#features",
    blurb: "Goals workspace — destination, missions, and progress. VYRA consults it; it doesn’t own it.",
  },
  {
    id: "kashu",
    href: "/cash-flow",
    blurb: "Cash-flow intelligence — Safe to Spend after obligations and your safety floor.",
  },
  {
    id: "vyra",
    href: "/#features",
    blurb: "Chief of Staff — consults UPLIFT, Kashu, DayO, and KINZO. Doesn’t own goals or money.",
  },
];
