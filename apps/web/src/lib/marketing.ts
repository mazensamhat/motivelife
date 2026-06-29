import { PLAN_NAME, PLAN_PRICE_LABEL } from "@/lib/subscription";

export const MARKETING_TAGLINE = "Your AI partner for a better life";

export const TRIAL_DAYS = 14;

export const PLAN_PRICE_CAD = "$14.99 CAD/month";

export const PRICING_HEADLINE = `${TRIAL_DAYS}-day free trial, then ${PLAN_PRICE_LABEL}`;

export const PRO_FEATURES = [
  "AI coach that learns your goals, beliefs, and preferences",
  "Morning briefing & evening review — clarity every day",
  "Voice organize — talk, and MotiveLife turns it into tasks & goals",
  "Life Engine streaks & Life GPS north-star tracking",
  "Life Graph — goals, tasks, and domains in one private map",
  "Sunday weekly letters & monthly life reviews",
  "Full access to all life modules",
] as const;

export const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Set your focus",
    description:
      "Pick what you're working toward — career, money, health, habits, and more. MotiveLife adapts to your life, not the other way around.",
  },
  {
    step: "02",
    title: "Start with clarity",
    description:
      "Each morning, your Chief of Staff briefing tells you what matters today — one mission, your priorities, and the exact next step.",
  },
  {
    step: "03",
    title: "Take action daily",
    description:
      "Complete tasks, talk to organize your mind, build streaks, and watch your Life Score grow. Action beats endless chat.",
  },
] as const;

export const FEATURE_PILLARS = [
  {
    icon: "sunrise" as const,
    title: "Morning Briefing",
    description:
      "Wake up to a personalized daily mission — not a generic to-do list. Know exactly where to start.",
  },
  {
    icon: "mic" as const,
    title: "Voice Organize",
    description:
      "Brain dump out loud. MotiveLife captures, structures, and connects what you say to your goals.",
  },
  {
    icon: "compass" as const,
    title: "Life GPS",
    description:
      "Set your north-star destination. Every goal and task links back to where you're actually going.",
  },
  {
    icon: "flame" as const,
    title: "Life Engine",
    description:
      "Daily next-actions, streaks, and momentum. Small wins compound into real life change.",
  },
  {
    icon: "chart" as const,
    title: "Life Graph",
    description:
      "Career, money, health, relationships — one connected map of your progress, private to you.",
  },
  {
    icon: "mail" as const,
    title: "Weekly Letters",
    description:
      "Every Sunday, a reflection on your wins, patterns, and focus for the week ahead.",
  },
] as const;

export const TRUST_POINTS = [
  "14-day free trial",
  "Cancel anytime",
  "Stripe secure billing",
  "PIPEDA-ready privacy",
] as const;

export { PLAN_NAME, PLAN_PRICE_LABEL };
