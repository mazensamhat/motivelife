/** Client-safe marketing copy — no server-only imports */

export const CATEGORY_NAME = "AI Life Operating System";

export const MARKETING_TAGLINE = "The AI Life Operating System";

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

export const PLAN_PRICE_CAD = "$14.99 CAD/month";

/** Hero — one job: why trust this AI with your life? */
export const HERO_HEADLINE = "Why trust an AI with your life?";
export const HERO_HEADLINE_ACCENT = "Because it already understands your calendar, money, health, and goals — together.";
export const HERO_SUBHEAD =
  "MotiveLife is the AI Life Operating System. Not another to-do app. One intelligence that runs your day, your week, and your long-term plan — privately.";

export const FINAL_CTA_HEADLINE = "Meet tomorrow's you.";
export const FINAL_CTA_SUBHEAD =
  "See what your AI already knows about your life — and what it recommends next.";
export const FINAL_CTA_BUTTON = "See what your AI already knows";

export const DEMO_VIDEO_PATH = "/marketing/product-demo.mp4";

export const LIVE_PHONE_SCENARIOS = [
  {
    id: "sarah",
    day: "Monday",
    greeting: "Good morning, Sarah.",
    lifeScore: 84,
    lines: [
      "Mortgage due Thursday",
      "Interview at 2 PM — leave at 1:18 PM",
      "You're on track for your savings goal",
    ],
  },
  {
    id: "james",
    day: "Tuesday",
    greeting: "Good morning, James.",
    lifeScore: 71,
    lines: [
      "You slept 5h 42m",
      "Heavy workload today — 6 meetings",
      "Move your workout to tomorrow",
    ],
  },
  {
    id: "maya",
    day: "Wednesday",
    greeting: "Good morning, Maya.",
    lifeScore: 88,
    lines: [
      "Vacation in 12 days",
      "Kids' soccer tonight at 6 PM",
      "Dentist tomorrow — leave by 8:45 AM",
    ],
  },
] as const;

export const LIFE_SCALE_STEPS = [
  { label: "Today", detail: "One mission, one briefing, one clear next step." },
  { label: "This week", detail: "Cashflow, calendar load, and habit streaks in sync." },
  { label: "This month", detail: "Goals, bills, and life areas moving forward together." },
  { label: "This year", detail: "Career moves, savings, health — not in separate apps." },
  { label: "Your life", detail: "A permanent memory of who you're becoming." },
] as const;

export const CONNECTED_LIFE_NODES = [
  "Calendar",
  "Money",
  "Health",
  "Goals",
  "Habits",
  "Relationships",
] as const;

export const AI_BRAIN_INPUTS = [
  "Calendar",
  "Bills",
  "Sleep",
  "Tasks",
  "Goals",
  "Weather",
  "Traffic",
] as const;

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

export const TRUST_PILLARS = [
  {
    title: "Privacy first",
    detail: "Your life data is yours. We don't sell it. Ever.",
  },
  {
    title: "Encrypted",
    detail: "Data in transit and at rest. Industry-standard security.",
  },
  {
    title: "You own your data",
    detail: "Export or delete your account and data anytime.",
  },
  {
    title: "Built responsibly",
    detail: "PIPEDA-ready practices. Clear policies. Human support.",
  },
] as const;

/** Placeholder testimonials — replace with real quotes as they come in */
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
  {
    name: "Maya Patel",
    role: "Marketing Director",
    location: "Mumbai, India",
    quote:
      "Soccer practice, dentist, vacation countdown — one briefing. I finally feel like something is running my life with me.",
  },
  {
    name: "Lucas Ferreira",
    role: "Entrepreneur",
    location: "São Paulo, Brazil",
    quote:
      "Money and calendar in the same place changed how I plan my week. It's an operating system, not a to-do list.",
  },
  {
    name: "Emma Johansson",
    role: "UX Designer",
    location: "Stockholm, Sweden",
    quote:
      "The Life Feed feels like someone competent is watching my back. Less stress, more clarity every morning.",
  },
  {
    name: "David Kim",
    role: "Financial Analyst",
    location: "Seoul, South Korea",
    quote:
      "It warned me about a savings slip three weeks early. That alone paid for the subscription.",
  },
  {
    name: "Aisha Mohammed",
    role: "Physician",
    location: "Lagos, Nigeria",
    quote:
      "Between shifts and family, I needed one brain for everything. MotiveLife is that brain.",
  },
  {
    name: "Marco Rossi",
    role: "Architect",
    location: "Milan, Italy",
    quote:
      "Predictions about my week feel intelligent — not generic productivity tips. It knows my actual schedule.",
  },
  {
    name: "Sophie Dubois",
    role: "HR Lead",
    location: "Paris, France",
    quote:
      "I trust it with goals I wouldn't paste into a random AI chat. Privacy and context matter.",
  },
  {
    name: "Ryan O'Brien",
    role: "Sales Director",
    location: "Dublin, Ireland",
    quote:
      "Voice organize in the car, briefing at my desk — my whole day flows from one place now.",
  },
  {
    name: "Yuki Tanaka",
    role: "Research Scientist",
    location: "Tokyo, Japan",
    quote:
      "Life Score and habits linked to career goals — finally one system instead of six apps.",
  },
  {
    name: "Olivia Martinez",
    role: "Teacher",
    location: "Mexico City, Mexico",
    quote:
      "It reminded me I hadn't called my mom in weeks. Small thing, but that's real life management.",
  },
  {
    name: "Ahmed Hassan",
    role: "Consultant",
    location: "Dubai, UAE",
    quote:
      "Travel, bills, meetings — connected. I describe it to friends as an AI life OS and they get it immediately.",
  },
  {
    name: "Chloe Nguyen",
    role: "Startup Founder",
    location: "Sydney, Australia",
    quote:
      "Burnout warning before burnout hit. The prediction engine is scary good in the best way.",
  },
  {
    name: "Peter van der Berg",
    role: "Operations Manager",
    location: "Amsterdam, Netherlands",
    quote:
      "Notion for notes, Google for calendar, spreadsheets for money — I replaced the mental load with MotiveLife.",
  },
  {
    name: "Isabella Costa",
    role: "Content Creator",
    location: "Lisbon, Portugal",
    quote:
      "Life Feed is genius. It's like Instagram except every post is actually about my life.",
  },
  {
    name: "Michael Thompson",
    role: "Attorney",
    location: "New York, USA",
    quote:
      "I was skeptical about trusting an AI with personal data. The privacy stance and daily value won me over.",
  },
  {
    name: "Fatima Al-Rashid",
    role: "Data Analyst",
    location: "Riyadh, Saudi Arabia",
    quote:
      "Morning briefing is my single source of truth. One mission, one next step — I start faster.",
  },
  {
    name: "Henrik Larsen",
    role: "Civil Engineer",
    location: "Copenhagen, Denmark",
    quote:
      "Health, sleep, and workload in one view. It suggested rest before I crashed — that's a life OS.",
  },
  {
    name: "Grace Mbeki",
    role: "Nonprofit Director",
    location: "Nairobi, Kenya",
    quote:
      "We serve others all day; MotiveLife helps me serve my own life too. Goals, money, family — connected.",
  },
] as const;

/** Capability metrics until live platform stats are wired — honest, not inflated user counts */
export const PLATFORM_PROOF = [
  { value: "7", label: "Life domains connected", suffix: "" },
  { value: "1", label: "AI briefing every morning", suffix: "" },
  { value: "14", label: "Day free trial", suffix: "" },
  { value: "100", label: "Private to you", suffix: "%" },
] as const;

export const LIFE_FEED_EXAMPLES = [
  { icon: "💤", text: "You've improved your sleep 12% this week.", time: "2h ago" },
  { icon: "🚗", text: "Leave by 1:18 PM to make your interview on time.", time: "4h ago" },
  { icon: "📅", text: "Today's workload is lighter — good day for deep work.", time: "6h ago" },
  { icon: "🏠", text: "Mortgage payment due Thursday.", time: "Yesterday" },
  { icon: "📞", text: "You haven't called Mom in 18 days.", time: "Yesterday" },
] as const;

export const PRO_FEATURES = [
  "Life Prediction Engine — proactive alerts before problems hit",
  "Morning briefing & evening review — clarity every day",
  "Voice organize — talk, and MotiveLife structures your life",
  "Money, career, health, habits — one connected map",
  "Life Feed — what your AI noticed, like a social feed for your life",
  "Sunday weekly letters & monthly life reviews",
  "Full access to every life module",
] as const;

/** @deprecated Legacy landing sections — kept for unused components */
export const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Connect your life",
    description: "Calendar, money, health, goals — MotiveLife sees the full picture.",
  },
  {
    step: "02",
    title: "Get your briefing",
    description: "Each morning: Life Score, mission, and what matters today.",
  },
  {
    step: "03",
    title: "Act with confidence",
    description: "Predictions, Life Feed, and one AI that keeps you on track.",
  },
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
  { generic: "No cross-domain view", motivelife: "Calendar + money + health connected" },
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
