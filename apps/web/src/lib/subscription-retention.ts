export type SubscriptionPlan = "trial" | "plus";

export interface SubscriptionState {
  plan: SubscriptionPlan;
  status: "active" | "paused" | "cancelled";
  trialEndsAt?: string;
  pausedUntil?: string;
}

export interface RetentionContext {
  lifeScore: number;
  streak: number;
  bestStreak: number;
  momentsCount: number;
  goalsActive: number;
  tasksCompletedThisWeek: number;
  userName: string | null;
}

const STORAGE_KEY = "ml-subscription";

export function readSubscriptionState(): SubscriptionState {
  if (typeof window === "undefined") {
    return { plan: "trial", status: "active", trialEndsAt: defaultTrialEnd() };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { plan: "trial", status: "active", trialEndsAt: defaultTrialEnd() };
    return JSON.parse(raw) as SubscriptionState;
  } catch {
    return { plan: "trial", status: "active", trialEndsAt: defaultTrialEnd() };
  }
}

export function writeSubscriptionState(state: SubscriptionState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function isPremiumActive(state: SubscriptionState): boolean {
  if (state.status === "cancelled") return false;
  if (state.status === "paused") return true;
  if (state.plan === "plus") return true;
  if (state.plan === "trial" && state.trialEndsAt) {
    return new Date(state.trialEndsAt).getTime() > Date.now();
  }
  return true;
}

export function upgradeToPlus(state: SubscriptionState): SubscriptionState {
  return {
    ...state,
    plan: "plus",
    status: "active",
    pausedUntil: undefined,
  };
}

export function trialDaysLeft(state: SubscriptionState): number | null {
  if (state.plan !== "trial" || !state.trialEndsAt || state.status !== "active") return null;
  return Math.ceil((new Date(state.trialEndsAt).getTime() - Date.now()) / 86400000);
}

function defaultTrialEnd(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString();
}

export function buildRetentionPitch(ctx: RetentionContext): {
  headline: string;
  bullets: string[];
  offer: string;
} {
  const name = ctx.userName?.split(" ")[0] ?? "you";
  const bullets: string[] = [];

  if (ctx.streak >= 3) {
    bullets.push(`${ctx.streak}-day Life Engine streak — pause instead of losing momentum`);
  }
  if (ctx.momentsCount > 0) {
    bullets.push(`${ctx.momentsCount} life moments in your Memory timeline`);
  }
  if (ctx.goalsActive > 0) {
    bullets.push(`${ctx.goalsActive} active goals still on your Life GPS`);
  }
  if (ctx.tasksCompletedThisWeek > 0) {
    bullets.push(`${ctx.tasksCompletedThisWeek} tasks completed this week`);
  }
  if (ctx.lifeScore > 0) {
    bullets.push(`Motive Life Score of ${ctx.lifeScore} — your progress compounds here`);
  }

  if (bullets.length === 0) {
    bullets.push("Your AI coach learns your beliefs and preferences over time");
    bullets.push("Life Graph connects money, career, health, and habits in one place");
  }

  return {
    headline: `${name}, leaving now resets the compound effect`,
    bullets,
    offer: "Pause for 30 days instead — keep your streak, memories, and AI context. No charge while paused.",
  };
}
