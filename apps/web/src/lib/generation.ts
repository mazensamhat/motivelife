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
  | "home_life";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconKey;
  badge?: string;
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
  home: { href: "/dashboard", label: "Today" },
  goals: { href: "/dashboard#life-gps", label: "Goals" },
  tasks: { href: "/tasks", label: "Tasks" },
  ai: { href: "/dashboard#coach", label: "AI Coach" },
  learning: { href: "/learning", label: "Learning" },
  career: { href: "/career", label: "Career" },
  money: { href: "/money", label: "Money" },
  health: { href: "/health", label: "Health" },
  habits: { href: "/habits", label: "Habits" },
  social: { href: "/relationships", label: "Social" },
  discover: { href: "/learning", label: "Discover", badge: "New" },
  relationships: { href: "/relationships", label: "Relationships" },
  family: { href: "/relationships", label: "Family" },
  travel: { href: "/dashboard", label: "Travel" },
  hobbies: { href: "/habits", label: "Hobbies" },
  connect: { href: "/integrations", label: "Connect" },
  memory: { href: "/memory", label: "Memory" },
  more: { href: "/settings", label: "Settings" },
  feed: { href: "/dashboard#feed", label: "Life Feed" },
  business: { href: "/career", label: "Business" },
  home_life: { href: "/money", label: "Home" },
};

/** Outcome-based navigation — goals/tasks/habits live inside modules */
const OUTCOME_NAV: NavIconKey[] = [
  "home",
  "memory",
  "relationships",
  "career",
  "money",
  "health",
  "learning",
  "home_life",
  "business",
  "feed",
  "ai",
];

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
    nav: nav(...OUTCOME_NAV),
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
    nav: nav(...OUTCOME_NAV),
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
    nav: nav(...OUTCOME_NAV),
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
    nav: nav(...OUTCOME_NAV),
  },
};

export function getGenerationTheme(generation: Generation): GenerationTheme {
  return GENERATION_THEMES[generation];
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
