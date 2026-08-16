/** Client-safe Kashu marketing copy — Cash-Flow Intelligence */

export const KASHU_PAGE_PATH = "/cash-flow";
/** Authenticated product home */
export const KASHU_APP_PATH = "/kashu";

export const KASHU_PRODUCT_NAME = "Kashu";
export const KASHU_CATEGORY = "Cash-Flow Intelligence";

export const KASHU_META_TITLE =
  "Kashu — Know what's safe before you spend | MyMotiveLife";

export const KASHU_META_DESCRIPTION =
  "Kashu is Cash-Flow Intelligence inside MyMotiveLife. Safe to Spend after obligations and your safety floor — statement upload, forecast radar, timing optimizer, and what-if. No bank connect required.";

export const KASHU_TAGLINE = "Know what's safe before you spend.";

export const KASHU_HERO_LINES = [
  "The bank shows what you have.",
  "Kashu shows what is yours to use.",
] as const;

export const KASHU_SUPPORTING_LINE =
  "Real-time clarity on your money — what's coming, what's already committed, and exactly what you can safely spend.";

export const KASHU_PRODUCT_STATEMENT =
  "Prevent cash-flow collisions before they happen. Timing-aware forecasting — not another budget spreadsheet.";

export const KASHU_CTA_PRIMARY = "Open Kashu";
export const KASHU_CTA_SECONDARY = "Build My Digital Twin";

export const KASHU_FORMULA = {
  eyebrow: "Primary metric",
  headline: "Safe to Spend",
  equation: "Bank Balance − Reserved Obligations − Safety Floor",
  detail:
    "A healthy balance can still hide a collision before payday. Kashu reserves what already belongs to bills and buffers — then shows the number you can actually use.",
  parts: [
    {
      label: "Bank Balance",
      body: "What is physically in the account — entered manually or learned from a statement upload.",
    },
    {
      label: "Reserved",
      body: "Money already committed to upcoming obligations through your next payday.",
    },
    {
      label: "Safety Floor",
      body: "An optional buffer inside the operating account treated as unavailable.",
    },
  ],
} as const;

export const KASHU_INTELLIGENCE_PILLARS = [
  {
    title: "Protect what matters",
    body: "Bills, obligations, and a safety floor stay reserved — not spendable.",
  },
  {
    title: "See the future",
    body: "Forecast from today through your next paydays so collisions surface early.",
  },
  {
    title: "Spend with confidence",
    body: "Safe to Spend is the number you can use without breaking the plan.",
  },
] as const;

export const KASHU_FEATURES = [
  {
    id: "upload",
    title: "Statement upload — no bank login",
    body: "PDF, CSV, or paste. Kashu extracts transactions, detects recurrings, and updates balance and payday when found. You confirm before anything becomes a bill.",
  },
  {
    id: "radar",
    title: "Cash-Flow Radar",
    body: "A timeline from today → next payday → 30 days. Green when covered, yellow near your floor, red when a collision is projected.",
  },
  {
    id: "timing",
    title: "Bill Timing Optimizer",
    body: "When income is enough but timing creates a gap, Kashu simulates moving controllable bills and shows the projected low for each option.",
  },
  {
    id: "whatif",
    title: "What-If simulator",
    body: "Ask “what if I spend $400 today?” before you spend it — see Safe to Spend and projected low update instantly.",
  },
  {
    id: "buffers",
    title: "Emergency & safety floor",
    body: "Emergency reserves stay protected. Your operating safety floor is never counted as Safe to Spend.",
  },
  {
    id: "transition",
    title: "Transition Mode",
    body: "Switching banks? Track payroll and each recurring PAD until the new account is healthy — then close the old one safely.",
  },
  {
    id: "ask",
    title: "Ask Kashu",
    body: "Cash-flow questions answered from your forecast — not generic advice. VYRA remains your broader AI; Kashu owns the money model.",
  },
] as const;

export const KASHU_PRIVACY_PILLARS = [
  {
    title: "No bank connect required",
    detail:
      "Upload statements or enter balances yourself. Optional bank aggregation stays out of scope so you keep control.",
  },
  {
    title: "Your data stays on your login",
    detail:
      "Income, bills, statements, and transition notes are private to your account — never shared across users.",
  },
  {
    title: "You confirm before Kashu commits",
    detail:
      "Detected recurrings wait for your approval. Corrections teach the model more than automated guesses.",
  },
] as const;

export const KASHU_SUCCESS_QUESTIONS = [
  "What can I safely spend today?",
  "What bills are already funded?",
  "What is my lowest projected balance before the next payday?",
  "Which future payment is creating a problem?",
  "What should I move, delay, or reserve to fix it?",
] as const;

export const KASHU_HOME_TEASER = {
  eyebrow: "Kashu · Cash-Flow Intelligence",
  headline: "Know what's safe before you spend.",
  bullets: [
    "Safe to Spend after obligations and your safety floor.",
    "Upload statements — no bank login required.",
    "See collisions before payday, not after.",
    "Timing optimizer, what-if, and Ask Kashu grounded in your forecast.",
  ],
  cta: "Explore Kashu →",
} as const;

export const KASHU_ECOSYSTEM_LINE =
  "Part of the MyMotiveLife suite — DayO, LifeVue, KINZO, UPLIFT, Kashu, and VYRA. Included with MyMotiveLife Pro.";

export const KASHU_DEMO = {
  safeToSpend: 412,
  balance: 2840,
  reserved: 1928,
  floor: 500,
  message: "You're safe to spend $412 until Friday. All scheduled obligations are covered.",
  radar: [
    { date: "Today", kind: "now", title: "Safe envelope", amount: 412, status: "green" as const },
    { date: "Fri", kind: "payday", title: "Payday", amount: 3695, status: "green" as const },
    { date: "Mon", kind: "bill", title: "Vehicle", amount: -380, status: "green" as const },
    { date: "Wed", kind: "bill", title: "Utilities", amount: -715, status: "yellow" as const },
    { date: "1st", kind: "bill", title: "Mortgage", amount: -3889, status: "green" as const },
  ],
} as const;
