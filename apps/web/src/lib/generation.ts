export type Generation = "GEN_Z" | "MILLENNIAL" | "GEN_X" | "BOOMER";

export type NavIconKey =
  | "home"
  | "goals"
  | "tasks"
  | "ai"
  | "learning"
  | "career"
  | "money"
  | "health"
  | "habits"
  | "social"
  | "discover"
  | "relationships"
  | "family"
  | "travel"
  | "hobbies"
  | "connect"
  | "memory"
  | "more"
  | "feed"
  | "business"
  | "home_life"
  | "life_hub"
  | "intelligence"
  | "settings";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconKey;
  badge?: string;
  subtitle?: string;
}

export interface GenerationTheme {
  id: Generation;
  label: string;
  ageRange: string;
  primary: string;
  primaryLight: string;
  primaryDark: string;
  primaryMuted: string;
  greeting: string;
  sidebarTagline: string;
  nav: NavItem[];
}

export const GENERATIONS: Generation[] = ["GEN_Z", "MILLENNIAL", "GEN_X", "BOOMER"];

export function getGenerationFromBirthYear(birthYear: number | null | undefined): Generation {
  if (!birthYear) return "MILLENNIAL";
  const age = new Date().getFullYear() - birthYear;
  if (age <= 24) return "GEN_Z";
  if (age <= 34) return "MILLENNIAL";
  if (age <= 44) return "GEN_X";
  return "BOOMER";
}

export function birthYearFromGeneration(generation: Generation): number {
  const year = new Date().getFullYear();
  switch (generation) {
    case "GEN_Z":
      return year - 20;
    case "MILLENNIAL":
      return year - 30;
    case "GEN_X":
      return year - 40;
    case "BOOMER":
      return year - 55;
  }
}

const CORE: Record<NavIconKey, Omit<NavItem, "icon">> = {
  home: { href: "/dashboard", label: "DayO", subtitle: "Your day" },
  life_hub: {
    href: "/my-life",
    label: "LifeVue",
    subtitle: "Your life in one view",
  },
  goals: {
    href: "/dashboard#life-gps",
    label: "UPLIFT",
    subtitle: "Your goals, elevated",
  },
  tasks: { href: "/tasks", label: "Tasks" },
  ai: {
    href: "/dashboard#coach",
    label: "VYRA AI",
    subtitle: "Your personal AI Chief of Staff",
  },
  learning: { href: "/learning", label: "Learning" },
  career: { href: "/career", label: "Career" },
  money: { href: "/money", label: "Money" },
  health: { href: "/health", label: "Health" },
  habits: { href: "/habits", label: "Habits" },
  social: { href: "/relationships", label: "Social" },
  discover: { href: "/learning", label: "Discover", badge: "New" },
  relationships: { href: "/relationships", label: "Relationships" },
  family: {
    href: "/family-map",
    label: "KINZO AI",
    subtitle: "Your family intelligence",
  },
  travel: { href: "/dashboard", label: "Travel" },
  hobbies: { href: "/habits", label: "Hobbies" },
  connect: {
    href: "/integrations",
    label: "Connect",
    subtitle: "Apps, devices & services",
  },
  memory: {
    href: "/memory",
    label: "MotiveIQ",
    subtitle: "Patterns, memory & insights",
  },
  intelligence: {
    href: "/memory",
    label: "MotiveIQ",
    subtitle: "Patterns, memory & insights",
  },
  more: { href: "/settings", label: "Settings", subtitle: "Preferences & privacy" },
  settings: {
    href: "/settings",
    label: "Settings",
    subtitle: "Preferences & privacy",
  },
  feed: {
    href: "/dashboard#feed",
    label: "Signals",
    subtitle: "What your AI noticed",
  },
  business: { href: "/career", label: "Business" },
  home_life: { href: "/money", label: "Home" },
};

/** Simplified top-level navigation */
const SIMPLIFIED_NAV: NavIconKey[] = [
  "home",
  "life_hub",
  "family",
  "goals",
  "ai",
  "intelligence",
  "feed",
  "connect",
  "settings",
];

export interface NavGroup {
  label: string;
  keys: NavIconKey[];
  defaultOpen?: boolean;
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Main Apps",
    keys: ["home", "life_hub", "family", "goals", "ai"],
    defaultOpen: true,
  },
  {
    label: "Intelligence",
    keys: ["intelligence", "feed", "connect", "settings"],
    defaultOpen: false,
  },
];

/** Secondary links shown below grouped nav (not duplicated under Settings). */
export const NAV_SECONDARY_KEYS: NavIconKey[] = [];

function nav(...keys: NavIconKey[]): NavItem[] {
  return keys.map((icon) => ({ icon, ...CORE[icon] }));
}

export const GENERATION_THEMES: Record<Generation, GenerationTheme> = {
  GEN_Z: {
    id: "GEN_Z",
    label: "Gen Z",
    ageRange: "16–24",
    primary: "#7C3AED",
    primaryLight: "#EDE9FE",
    primaryDark: "#5B21B6",
    primaryMuted: "#A78BFA",
    greeting: "Hey",
    sidebarTagline: "One AI. Every Stage of Life.",
    nav: nav(...SIMPLIFIED_NAV),
  },
  MILLENNIAL: {
    id: "MILLENNIAL",
    label: "Millennials",
    ageRange: "25–34",
    primary: "#10B981",
    primaryLight: "#D1FAE5",
    primaryDark: "#059669",
    primaryMuted: "#6EE7B7",
    greeting: "Good morning",
    sidebarTagline: "One AI. Every Stage of Life.",
    nav: nav(...SIMPLIFIED_NAV),
  },
  GEN_X: {
    id: "GEN_X",
    label: "Gen X",
    ageRange: "35–44",
    primary: "#3B82F6",
    primaryLight: "#DBEAFE",
    primaryDark: "#2563EB",
    primaryMuted: "#93C5FD",
    greeting: "Good morning",
    sidebarTagline: "One AI. Every Stage of Life.",
    nav: nav(...SIMPLIFIED_NAV),
  },
  BOOMER: {
    id: "BOOMER",
    label: "Boomers & Beyond",
    ageRange: "45+",
    primary: "#8B5CF6",
    primaryLight: "#EDE9FE",
    primaryDark: "#7C3AED",
    primaryMuted: "#C4B5FD",
    greeting: "Good morning",
    sidebarTagline: "One AI. Every Stage of Life.",
    nav: nav(...SIMPLIFIED_NAV),
  },
};

export function getGenerationTheme(generation: Generation): GenerationTheme {
  return GENERATION_THEMES[generation];
}

/** Time-of-day greeting in the user's local timezone (client) or server hour (SSR). */
export function getTimeOfDayGreeting(hour = new Date().getHours()): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function computeLifeScore(stats: {
  completedToday: number;
  completedWeek: number;
  activeGoals: number;
  livesMovedForward: number;
}): number {
  const base = 55;
  const taskBonus = Math.min(18, stats.completedWeek * 2);
  const todayBonus = Math.min(8, stats.completedToday * 4);
  const goalBonus = Math.min(12, stats.activeGoals * 2);
  const momentBonus = Math.min(12, stats.livesMovedForward * 2);
  return Math.min(99, Math.max(40, base + taskBonus + todayBonus + goalBonus + momentBonus));
}
