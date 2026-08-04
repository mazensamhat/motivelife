/** Client-safe marketing copy — homepage Master Brief */

export const CATEGORY_NAME = "AI Life Operating System";

export const MARKETING_TAGLINE = "Your life is more connected than you think.";

export const APP_STORE_HEADLINE = "Now on the App Store and Google Play";
export const APP_STORE_SUBLINE =
  "Download MotiveLife on iPhone or Android. Use the web anytime — your account syncs across devices.";

/** @deprecated Use APP_STORE_HEADLINE */
export const APP_COMING_SOON_HEADLINE = APP_STORE_HEADLINE;
/** @deprecated Use APP_STORE_SUBLINE */
export const APP_COMING_SOON_SUBLINE = APP_STORE_SUBLINE;

export const PLAY_STORE_CTA = "Get it on Google Play";
export const APP_STORE_CTA = "Download on the App Store";
/** @deprecated Use APP_STORE_CTA */
export const IOS_COMING_SOON_LABEL = APP_STORE_CTA;

export const TRIAL_DAYS = 14;

export const PLAN_PRICE_CAD = "$14.99 CAD / month";

/** Hero — brand first, then promise */
export const BRAND_NAME = "MotiveLife";
export const HERO_HEADLINE = "Know Where Your Life Is Headed.";
export const HERO_SUBHEAD =
  "MyMotiveLife Pro builds a living AI Digital Twin of you — including where your time actually goes — so it can predict what’s next and help you decide better every day.";
export const HERO_CTA = "Build My Digital Twin";
export const HERO_SECONDARY_CTA = "Watch the Demo";

/** @deprecated aliases for older sections */
export const HERO_HEADLINE_ACCENT = HERO_SUBHEAD;

export const FINAL_CTA_HEADLINE = "The Future Doesn't Have To Be A Guess.";
export const FINAL_CTA_SUBHEAD = "Build the AI that understands your life.";
export const FINAL_CTA_BUTTON = "Build My Digital Twin";

export const FOOTER_TAGLINE =
  "Your life is more connected than you think. MyMotiveLife helps you see it.";

export const DEMO_VIDEO_PATH = "/marketing/product-demo.mp4";

export const HERO_LIFE_NODES = [
  "Career",
  "Health",
  "Money",
  "Family",
  "Goals",
  "Travel",
  "Investments",
  "Calendar",
] as const;

export const DASHBOARD_QUESTIONS = [
  "Are you on track financially?",
  "Is your stress increasing?",
  "Will you reach retirement when you planned?",
  "Are you becoming healthier?",
  "Are your relationships improving?",
  "What one decision today will have the biggest impact on your future?",
] as const;

export const TWIN_BUILD_STEPS = [
  {
    step: 1,
    title: "Tell us about your life.",
    accuracy: 18,
    detail: "Identity, goals, and the basics your Twin needs to start learning.",
  },
  {
    step: 2,
    title: "Connect your world.",
    accuracy: 61,
    detail:
      "Calendar, health, money, and places you move through — optional signals that sharpen predictions.",
  },
  {
    step: 3,
    title: "AI begins learning.",
    accuracy: 84,
    detail:
      "Patterns across career, money, health, relationships, places, and movement start to emerge.",
  },
  {
    step: 4,
    title: "Your Digital Twin evolves.",
    accuracy: 97,
    detail: "Every day of signal — including where your time goes — makes tomorrow’s guidance sharper.",
  },
] as const;

export const FUTURE_DASHBOARD_METRICS = [
  { label: "Life Momentum", value: "82%", status: "Trending up" },
  { label: "Financial Future", value: "Healthy", status: "On track" },
  { label: "Career Growth", value: "Strong", status: "Growing" },
  { label: "Health", value: "Trending Up", status: "Improving" },
  { label: "Relationship Health", value: "Excellent", status: "Stable" },
  { label: "Stress", value: "Watch Closely", status: "Needs attention" },
] as const;

/** Primary Digital Twin signal chain — Pro is ME intelligence. */
export const TWIN_SIGNAL_CHAIN = [
  "Calendar",
  "Money",
  "Health",
  "Goals",
  "Habits",
  "Relationships",
  "Places",
  "Movement",
  "MotiveLife AI",
] as const;

export const CONNECTED_CHAIN = [
  "Sleep",
  "Energy",
  "Productivity",
  "Career",
  "Income",
  "Places",
  "Movement",
  "Relationships",
  "Health",
] as const;

/** Pro homepage — Places + Movement as personal Digital Twin intelligence. */
export const PRO_LIFE_HAPPENS_PLACES = [
  {
    place: "Work",
    stats: ["184 visits this year", "Average arrival 8:17 AM", "Average departure 5:41 PM"],
    insight: "Your average workday has increased by 43 minutes since April.",
  },
  {
    place: "Gym",
    stats: ["47 visits", "Average stay 61 min", "Last 30 days ↓22%"],
    insight: "Gym visits began declining shortly after your workday increased.",
  },
  {
    place: "Driving",
    stats: ["1,482 km this month", "38.4 hours", "21.6 hours commuting"],
    insight: "You spent nearly one full waking day commuting this month.",
  },
  {
    place: "Home",
    stats: ["Time at home ↓8%", "Average arrival 24 min later"],
    insight: "Your later work departures are reducing your weekday time at home.",
  },
] as const;

export const PRO_CONNECTED_DOTS = {
  eyebrow: "AI Connected the Dots",
  headline: "Something changed 6 weeks ago.",
  deltas: [
    "Your workday increased 43 minutes/day.",
    "Your commute increased 17%.",
    "Gym visits decreased 22%.",
    "Average sleep decreased 19 minutes.",
    "Transportation spending increased $94/month.",
  ],
  momentum: "Life Momentum: −4",
  insight: "These changes began within nine days of your office relocation.",
  cta: "See what your Digital Twin noticed →",
  ctaHref: "/register",
} as const;

export const FEATURE_STORIES = [
  {
    name: "Life Probability Engine™",
    story: "See the likely outcome of your current trajectory — not a guess, a probability.",
  },
  {
    name: "Future Simulator™",
    story:
      "Wondering what happens if you move, change jobs, buy a house, or retire early? Simulate possible futures before you decide.",
  },
  {
    name: "Invisible Pattern Detection™",
    story:
      "AI discovers relationships you would never notice — like a longer workday quietly cutting gym visits, sleep, and Life Momentum within nine days of an office move.",
  },
  {
    name: "Places + Movement Intelligence™",
    story:
      "Your Digital Twin can’t fully understand your life without knowing where your time goes. Pro learns your places and movement — then connects them to money, health, sleep, and Life Momentum. Family adds the household layer on top.",
  },
  {
    name: "Memory Intelligence™",
    story:
      "Your AI remembers the important details, preferences, and moments that make your life uniquely yours.",
  },
  {
    name: "Daily Life Brief™",
    story:
      "Every morning, receive one clear view of your life and the next best action to improve it.",
  },
] as const;

export const IMAGINE_ASKING = [
  "Can I retire five years earlier?",
  "Should I buy this house?",
  "Can I afford another child?",
  "Am I underpaid?",
  "Should I switch careers?",
  "Why am I always tired?",
  "Why do I overspend every December?",
  "How much is procrastination costing me?",
] as const;

export const FUTURE_TIMELINE = [
  { label: "Today", detail: "Baseline Twin + Life Momentum" },
  { label: "Six Months", detail: "Habits and cash-flow trajectory" },
  { label: "One Year", detail: "Career and health compounding" },
  { label: "Five Years", detail: "Net worth and life goals" },
  { label: "Retirement", detail: "Financial, lifestyle, and risk outlook" },
] as const;

/**
 * Pricing page = two paid plans only.
 * Free forever (live Family Map + speed, basic Life home) is a product layer — not a SKU.
 * Avoid “Free Life” + “Free Family” tiles (two-free confusion).
 */
export const PRICING_FREE_FOREVER_LINE =
  "Live Family Map + speed is free forever. Basic Life home is included. Intelligence is optional.";

export const PRICING_TIERS = [
  {
    id: "pro",
    name: "MyMotiveLife Pro",
    price: "$14.99",
    period: "CAD / month",
    trial: `${TRIAL_DAYS}-day free trial · includes free Family Map · no card`,
    audience: "ME intelligence",
    features: [
      "Digital Twin™ + Places + Movement",
      "Life Probability Engine™ + Future Simulator™",
      "Daily Life Brief™ + Invisible Patterns",
      "Free Family Map + speed included",
      "Then $14.99 CAD/mo via Stripe",
    ],
    cta: "Start 14-day Pro trial",
    href: "/register",
    highlighted: false,
  },
  {
    id: "family",
    name: "MyMotiveFamily",
    price: "$19.99",
    period: "CAD / month",
    trial: "Includes Pro for the owner · map stays free · no card to start",
    audience: "Only $5 more than Pro",
    features: [
      "Free forever: live Family Map + driving speed",
      "Family Intelligence: history, Drive Score, Inbox, AI",
      "Everything in MyMotiveLife Pro for the owner",
      "Up to 6 household members",
      "Family Flow™ + Something’s Different™",
    ],
    cta: "Start free map · unlock intelligence",
    href: "/register?plan=family",
    highlighted: true,
  },
] as const;

export const PRICING_MEMBER_FOOTNOTE =
  "Household members can unlock their private Digital Twin Pro for +$5 CAD/month (Stripe). Their data stays private.";

/** Short lock-overlay copy — intelligence only; never blur the live map. */
export const LOCK_COPY = {
  familyIntelOwner: {
    title: "Family Intelligence",
    body: "History, Drive Score, and calm alerts.",
    cta: "Unlock — $19.99/mo",
    note: "Includes Pro for you. Live map stays free.",
  },
  familyIntelMemberWaiting: {
    title: "Waiting on Family Intelligence",
    body: "Ask the household owner to unlock — or keep using the live map free.",
    cta: null,
    note: null,
  },
  memberTwin: {
    title: "Your private Pro",
    body: "Full Digital Twin — only you see it.",
    cta: "Unlock — $5/mo",
    note: null,
  },
  lifePro: {
    title: "MyMotiveLife Pro",
    body: "Full Twin, Places + Movement, and deeper predictions.",
    cta: "Try 14 days free — no card",
    note: "Then $14.99/mo",
  },
} as const;

export const TRUST_PILLARS = [
  {
    title: "You decide what to share",
    detail: "Connect only what you want. Disconnect anytime.",
  },
  {
    title: "You decide what to forget",
    detail: "Delete data and reset parts of your Twin when you choose.",
  },
  {
    title: "Every prediction explains why",
    detail: "No black box — see what influenced each insight.",
  },
  {
    title: "Confidence, always visible",
    detail: "Recommendations show how complete your Twin is.",
  },
] as const;

export const PRO_FEATURES = [
  "Unlimited Predictions",
  "Future Simulator™",
  "Invisible Pattern Detection™",
  "Places + Movement intelligence",
  "Unlimited Integrations",
  "Priority AI",
  "Daily Life Brief™",
  "Full access to every life module",
] as const;

/** Kept for legacy components still imported elsewhere */
export const LIFE_SCALE_STEPS = [
  { label: "Today", detail: "One mission, one briefing, one better future decision." },
  { label: "This week", detail: "Cashflow, calendar load, and habit streaks in sync." },
  { label: "This month", detail: "Goals, bills, and life areas moving as one system." },
  { label: "This year", detail: "Career, savings, health — predicted together." },
  { label: "Your Twin", detail: "A living Digital Twin that never forgets who you're becoming." },
] as const;

export const CONNECTED_LIFE_NODES = HERO_LIFE_NODES;
export const AI_BRAIN_INPUTS = ["Calendar", "Bills", "Sleep", "Tasks", "Goals", "Weather", "Traffic"] as const;
export const PREDICTION_EXAMPLES = [
  {
    tone: "warning" as const,
    text: "You're likely to miss your savings goal by 17 days unless you pause dining out this week.",
  },
  {
    tone: "positive" as const,
    text: "91% chance you complete today's mission if you start with the 25-minute focus block at 9 AM.",
  },
  {
    tone: "neutral" as const,
    text: "Sleep before 10:15 PM tonight — tomorrow's calendar is 40% heavier than usual.",
  },
  {
    tone: "warning" as const,
    text: "This week's spending pattern would delay your retirement target by ~2 months.",
  },
] as const;

export const TESTIMONIALS = [
  {
    name: "Sarah Chen",
    role: "Product Manager",
    location: "Toronto, Canada",
    quote:
      "It knew my mortgage date and interview before I even opened my calendar. That's when I stopped thinking of it as an app.",
  },
  {
    name: "James Okonkwo",
    role: "Software Engineer",
    location: "London, UK",
    quote:
      "Five hours of sleep, six meetings — it told me to move my workout. ChatGPT never connects those dots.",
  },
] as const;

export const PLATFORM_PROOF = [
  { value: "9", label: "Life domains connected", suffix: "" },
  { value: "1", label: "AI briefing every morning", suffix: "" },
  { value: "14", label: "Day free trial", suffix: "" },
  { value: "100", label: "Private to you", suffix: "%" },
] as const;

export const LIFE_FEED_EXAMPLES = [
  {
    icon: "🚗",
    text: "You spent 6.2 fewer hours commuting this month.",
    time: "2h ago",
  },
  {
    icon: "🏋️",
    text: "You’ve visited the gym three times this week — your best week since May.",
    time: "5h ago",
  },
  {
    icon: "💼",
    text: "You’ve left work later than normal for six consecutive weeks.",
    time: "Yesterday",
  },
  {
    icon: "❤️",
    text: "You haven’t visited Mom in 23 days.",
    time: "Yesterday",
  },
  {
    icon: "🛒",
    text: "Your grocery-store visits increased 31% this month. Spending increased at roughly the same time.",
    time: "2d ago",
  },
  {
    icon: "🏠",
    text: "You’ve spent 12% more waking time at home this month.",
    time: "3d ago",
  },
] as const;

export const HOW_IT_WORKS = [
  { step: "01", title: "Build your Twin", description: "Tell MotiveLife about your life." },
  { step: "02", title: "Connect signals", description: "Calendar, health, money — optionally." },
  { step: "03", title: "See the future", description: "Probabilities, simulations, daily briefs." },
] as const;

export const FEATURE_PILLARS = [
  {
    icon: "mic" as const,
    title: "Voice Organize",
    description: "Brain dump out loud. MotiveLife structures it into your life graph.",
  },
  {
    icon: "sunrise" as const,
    title: "Morning Briefing",
    description: "Wake up to a personalized daily mission — not a generic list.",
  },
  {
    icon: "compass" as const,
    title: "Life GPS",
    description: "North-star goals linked to daily actions.",
  },
  {
    icon: "flame" as const,
    title: "Life Engine",
    description: "Streaks, momentum, and next actions that compound.",
  },
  {
    icon: "chart" as const,
    title: "Life Graph",
    description: "Career, money, health, relationships — one private map.",
  },
  {
    icon: "mail" as const,
    title: "Weekly Letters",
    description: "Sunday reflection on wins, patterns, and focus.",
  },
] as const;

export const COMPARISON_ROWS = [
  { generic: "Answers questions", motivelife: "Runs your life operating system" },
  { generic: "Forgets context", motivelife: "Permanent Life Graph & Memory" },
  { generic: "Generic chat", motivelife: "Daily briefing + predictions" },
  {
    generic: "No cross-domain view",
    motivelife: "Calendar + money + health + places + movement connected",
  },
  { generic: "You type everything", motivelife: "Voice organize → structured life" },
  { generic: "Productivity app", motivelife: "AI Life Operating System" },
] as const;

export const TRUST_POINTS = [
  { label: "14-day free trial", icon: "gift" as const },
  { label: "Encrypted & private", icon: "shield" as const },
  { label: "Delete anytime", icon: "lock" as const },
  { label: "Stripe secure billing", icon: "sparkles" as const },
  { label: "Built in Canada", icon: "map" as const },
  { label: "No data sold", icon: "users" as const },
] as const;

export const LIVE_PHONE_SCENARIOS = [
  {
    id: "sarah",
    day: "Monday",
    greeting: "Good morning, Sarah.",
    lifeScore: 84,
    lines: ["Mortgage due Thursday", "Interview at 2 PM", "On track for savings"],
  },
] as const;
