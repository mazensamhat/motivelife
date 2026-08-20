import type { AlternativesPageConfig } from "./alternatives/types";
import { VITALU_APP_PATH, VITALU_PAGE_PATH, VITALU_PRODUCT_NAME } from "./vitalu-marketing";

export const VITALU_ALT_PATH = "/alternatives/myfitnesspal";

export const vitaluAlternativesConfig: AlternativesPageConfig = {
  path: VITALU_ALT_PATH,
  navActiveLabel: "Vitalu",
  productEyebrow: VITALU_PRODUCT_NAME,
  meta: {
    title: "7 Best MyFitnessPal & Wellness App Alternatives in 2026",
    metaTitle: "7 Best MyFitnessPal Alternatives (2026) | Vitalu Health Intelligence",
    metaDescription:
      "Compare MyFitnessPal alternatives — Vital Score, adaptive plans, optional Apple Health & Health Connect, and Digital Twin wellness. Not medical advice.",
    keywords: [
      "MyFitnessPal alternatives",
      "apps like MyFitnessPal",
      "best calorie tracker",
      "health app Canada",
      "Vitalu",
      "wellness app",
      "Health Intelligence",
      "Apple Health app alternative",
    ],
  },
  reviewed: "August 2026",
  heroSubtitle:
    "Compare leading wellness apps on logging, macros, and wearables — and the layer Vitalu is built for: adaptive Health Intelligence inside your Life OS.",
  keyDifference:
    'Most calorie apps answer "What did I eat?" Vitalu is designed to also answer "Given my sleep, calendar, and goals — what should today look like?"',
  strengthBands: [
    {
      title: "MyFitnessPal's strength: Huge food database",
      body: "Barcode scanning and community logging — the default for calorie counting at scale.",
    },
    {
      title: "Wearable apps: Device-native tracking",
      body: "Apple Fitness, Samsung Health, and Fitbit excel when you live inside one ecosystem.",
    },
    {
      title: "Vitalu's position: Health Intelligence",
      body: "Vital Score, adaptive plans, optional health connections, and Twin context — not just a log.",
    },
  ],
  comparisonFilters: [
    { id: "all", label: "All features", hint: "Showing all capabilities." },
    { id: "plan", label: "Planning", hint: "Goals, targets, and adaptive recommendations." },
    { id: "track", label: "Tracking", hint: "Food, movement, sleep, and recovery." },
    { id: "wearables", label: "Wearables", hint: "Apple Watch, Samsung, Health Connect." },
    { id: "life", label: "Life integration", hint: "Digital Twin and suite connections." },
  ],
  comparisonColumns: [
    { id: "mfp", label: "MyFitnessPal" },
    { id: "loseit", label: "Lose It!" },
    { id: "cronometer", label: "Cronometer" },
    { id: "ours", label: `${VITALU_PRODUCT_NAME}™`, ours: true },
  ],
  comparisonRows: [
    {
      id: "vital-score",
      capability: "Unified wellness score",
      category: "plan",
      cells: {
        mfp: { text: "Streaks / goals" },
        loseit: { text: "Budget-style calories" },
        cronometer: { text: "Nutrition completeness" },
        ours: { text: "✓ Vital Score — nutrition, movement, recovery, consistency", strong: true },
      },
    },
    {
      id: "adaptive",
      capability: "Adapts plan to sleep & calendar",
      category: "plan",
      cells: {
        mfp: { text: "Fixed calorie target" },
        loseit: { text: "Fixed budget" },
        cronometer: { text: "Fixed targets" },
        ours: { text: "✓ Recovery day vs push day", strong: true },
      },
    },
    {
      id: "food-log",
      capability: "Food logging",
      category: "track",
      cells: {
        mfp: { text: "✓ Largest database", strong: true },
        loseit: { text: "✓ Strong barcode scan" },
        cronometer: { text: "✓ Micronutrient depth" },
        ours: { text: "✓ Catalog + manual" },
      },
    },
    {
      id: "workouts",
      capability: "Workout routines & tracking",
      category: "track",
      cells: {
        mfp: { text: "Basic exercise log" },
        loseit: { text: "Basic" },
        cronometer: { text: "Exercise calories" },
        ours: { text: "✓ Workout engine + routines", strong: true },
      },
    },
    {
      id: "apple-health",
      capability: "Apple Health / Health Connect",
      category: "wearables",
      cells: {
        mfp: { text: "✓ Sync steps & weight" },
        loseit: { text: "✓ Sync" },
        cronometer: { text: "✓ Sync" },
        ours: { text: "✓ Optional — manual still works", strong: true },
      },
    },
    {
      id: "watch",
      capability: "Apple Watch / Samsung watch",
      category: "wearables",
      cells: {
        mfp: { text: "Via Health sync" },
        loseit: { text: "Via Health sync" },
        cronometer: { text: "Via Health sync" },
        ours: { text: "✓ Via Health Connect / Apple Health", strong: true },
      },
    },
    {
      id: "medical",
      capability: "Medical advice / diagnosis",
      category: "plan",
      cells: {
        mfp: { text: "Not medical" },
        loseit: { text: "Not medical" },
        cronometer: { text: "Not medical" },
        ours: { text: "Wellness software — not medical advice", strong: true },
      },
    },
    {
      id: "kashu",
      capability: "Connects to financial Life OS",
      category: "life",
      cells: {
        mfp: { text: "—" },
        loseit: { text: "—" },
        cronometer: { text: "—" },
        ours: { text: "✓ Kashu counterpart in same Twin", strong: true },
      },
    },
    {
      id: "kinzo",
      capability: "Movement context from family map",
      category: "life",
      cells: {
        mfp: { text: "—" },
        loseit: { text: "—" },
        cronometer: { text: "—" },
        ours: { text: "✓ KINZO AI commute & activity context", strong: true },
      },
    },
    {
      id: "twin",
      capability: "Personal Digital Twin",
      category: "life",
      cells: {
        mfp: { text: "—" },
        loseit: { text: "—" },
        cronometer: { text: "—" },
        ours: { text: "✓ MyMotiveLife Pro suite", strong: true },
      },
    },
  ],
  alternatives: [
    {
      id: "mfp",
      name: "MyFitnessPal",
      tag: "Calorie counting",
      whyChoose:
        "Massive food database, barcode scanning, and the default habit for millions of loggers.",
      bestFor: "People who want the biggest community food catalog.",
      limit: "Less emphasis on adaptive planning and full Life OS integration.",
    },
    {
      id: "loseit",
      name: "Lose It!",
      tag: "Budget calories",
      whyChoose: "Friendly calorie budgeting with strong scanning and streak motivation.",
      bestFor: "Straightforward weight-loss tracking with gamification.",
      limit: "Limited recovery-aware planning and suite hooks.",
    },
    {
      id: "cronometer",
      name: "Cronometer",
      tag: "Nutrient depth",
      whyChoose: "Micronutrient and biometrics depth for data-oriented users.",
      bestFor: "People who care about vitamin/mineral completeness.",
      limit: "Heavier UI; not a full household Life OS.",
    },
    {
      id: "noom",
      name: "Noom",
      tag: "Behavior coaching",
      whyChoose: "Psychology-forward weight program with coaching and color-coded foods.",
      bestFor: "Users who want guided behavior change, not just logging.",
      limit: "Separate subscription; not integrated with cash-flow or family context.",
    },
    {
      id: "apple-fitness",
      name: "Apple Fitness+",
      tag: "Ecosystem workouts",
      whyChoose: "Premium workouts tightly integrated with Apple Watch and Health.",
      bestFor: "Apple households already paying for the fitness subscription.",
      limit: "Apple-centric; less nutrition planning depth.",
    },
    {
      id: "samsung",
      name: "Samsung Health",
      tag: "Android / Galaxy",
      whyChoose: "Built into Galaxy watches and phones — steps, sleep, and workouts in one place.",
      bestFor: "Samsung / Android users who stay in one ecosystem.",
      limit: "Device-tied; limited cross-suite Life OS.",
    },
    {
      id: "vitalu",
      name: VITALU_PRODUCT_NAME,
      tag: "Health Intelligence",
      whyChoose:
        "Vital Score, adaptive plans, optional wearables via Health Connect / Apple Health, and Digital Twin wellness — included in MyMotiveLife Pro.",
      bestFor: "People who want health planning that adapts to real life, not just a daily log.",
      limit: "Wellness software — not medical advice or clinical diagnosis.",
      href: VITALU_PAGE_PATH,
      featured: true,
    },
  ],
  chooseTraditional: {
    title: "Choose a traditional calorie app if…",
    body: "Your priority is the largest food database, standalone coaching programs, or living entirely inside Apple Fitness or Samsung Health.",
  },
  chooseOurs: {
    title: `Choose ${VITALU_PRODUCT_NAME} if…`,
    body: "You want nutrition, movement, and recovery in one adaptive plan — with optional wearables and connection to your broader Digital Twin.",
  },
  ctaEyebrow: VITALU_PRODUCT_NAME,
  ctaHeadline: "Calorie apps count.",
  ctaTagline: "Vitalu plans, tracks, and adapts — with your actual life.",
  ctaDetail:
    "Vital Score and adaptive wellness are included with MyMotiveLife Pro — alongside Kashu, KINZO AI, and your Digital Twin.",
  primaryCta: { href: VITALU_APP_PATH, label: "Open Vitalu" },
  secondaryCta: { href: VITALU_PAGE_PATH, label: `Explore ${VITALU_PRODUCT_NAME}` },
  disclaimerProductName: VITALU_PRODUCT_NAME,
};
