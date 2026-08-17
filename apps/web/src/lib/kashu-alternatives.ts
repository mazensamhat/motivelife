import type { AlternativesPageConfig } from "./alternatives/types";
import { KASHU_APP_PATH, KASHU_PAGE_PATH, KASHU_PRODUCT_NAME } from "./kashu-marketing";

export const KASHU_ALT_PATH = "/alternatives/ynab";

export const kashuAlternativesConfig: AlternativesPageConfig = {
  path: KASHU_ALT_PATH,
  navActiveLabel: "Kashu",
  productEyebrow: KASHU_PRODUCT_NAME,
  meta: {
    title: "7 Best YNAB & Budget App Alternatives in 2026",
    metaTitle: "7 Best YNAB Alternatives (2026) | Kashu Cash-Flow Intelligence",
    metaDescription:
      "Compare YNAB alternatives and budget apps — Safe to Spend, bill timing, and cash-flow forecasting without bank login. Kashu is part of MyMotiveLife Pro.",
    keywords: [
      "YNAB alternatives",
      "apps like YNAB",
      "best budget app Canada",
      "Mint alternative",
      "cash flow app",
      "Safe to Spend",
      "Kashu",
      "no bank connect budget",
    ],
  },
  reviewed: "August 2026",
  heroSubtitle:
    "Compare leading money apps on envelopes, tracking, and forecasting — and the layer Kashu is built for: timing-aware Cash-Flow Intelligence.",
  keyDifference:
    'Most budget apps answer "How much did I spend?" Kashu is designed to also answer "How much can I safely use right now — after bills, buffers, and payday timing?"',
  strengthBands: [
    {
      title: "YNAB's strength: Envelope discipline",
      body: "Every dollar gets a job — excellent for intentional spenders who commit to the method.",
    },
    {
      title: "Bank-sync apps: Automatic tracking",
      body: "Mint successors and aggregators excel at categorizing transactions after they happen.",
    },
    {
      title: "Kashu's position: Cash-Flow Intelligence",
      body: "Safe to Spend, bill waves, Payday Mode, and Life OS hooks — no bank login required.",
    },
  ],
  comparisonFilters: [
    { id: "all", label: "All features", hint: "Showing all capabilities." },
    { id: "forecast", label: "Forecasting", hint: "Forward-looking cash flow and Safe to Spend." },
    { id: "bills", label: "Bills & timing", hint: "Obligations, payday alignment, and bill waves." },
    { id: "privacy", label: "Privacy & setup", hint: "Bank connection, manual entry, and data control." },
    { id: "life", label: "Life integration", hint: "Digital Twin and suite connections." },
  ],
  comparisonColumns: [
    { id: "ynab", label: "YNAB" },
    { id: "mint", label: "Mint / Monarch" },
    { id: "spreadsheets", label: "Spreadsheets" },
    { id: "ours", label: `${KASHU_PRODUCT_NAME}™`, ours: true },
  ],
  comparisonRows: [
    {
      id: "safe-to-spend",
      capability: "Safe to Spend (usable balance today)",
      category: "forecast",
      cells: {
        ynab: { text: "Available in categories" },
        mint: { text: "Balance minus budgets (varies)" },
        spreadsheets: { text: "DIY formula" },
        ours: { text: "✓ Primary metric — balance − reserved − floor", strong: true },
      },
    },
    {
      id: "payday",
      capability: "Payday-aware forecasting",
      category: "forecast",
      cells: {
        ynab: { text: "Monthly / target-based" },
        mint: { text: "Monthly views" },
        spreadsheets: { text: "Manual" },
        ours: { text: "✓ Payday Mode + 30-day radar", strong: true },
      },
    },
    {
      id: "what-if",
      capability: "What-if before you spend",
      category: "forecast",
      cells: {
        ynab: { text: "Move money between categories" },
        mint: { text: "Limited" },
        spreadsheets: { text: "Manual scenarios" },
        ours: { text: "✓ Can I Afford + What-If", strong: true },
      },
    },
    {
      id: "bill-timing",
      capability: "Bill timing optimizer",
      category: "bills",
      cells: {
        ynab: { text: "Scheduled transactions" },
        mint: { text: "Bill reminders" },
        spreadsheets: { text: "Manual calendar" },
        ours: { text: "✓ Bill Timing Optimizer", strong: true },
      },
    },
    {
      id: "reserved",
      capability: "Reserved obligations",
      category: "bills",
      cells: {
        ynab: { text: "✓ Envelope assignments" },
        mint: { text: "Budget categories" },
        spreadsheets: { text: "Manual rows" },
        ours: { text: "✓ Auto-reserved through next payday", strong: true },
      },
    },
    {
      id: "no-bank",
      capability: "Works without bank login",
      category: "privacy",
      cells: {
        ynab: { text: "Sync optional" },
        mint: { text: "Bank sync core" },
        spreadsheets: { text: "✓ Fully manual" },
        ours: { text: "✓ Statement upload or manual — no connect required", strong: true },
      },
    },
    {
      id: "statement",
      capability: "Statement upload learning",
      category: "privacy",
      cells: {
        ynab: { text: "Import / sync" },
        mint: { text: "Auto-sync" },
        spreadsheets: { text: "Manual paste" },
        ours: { text: "✓ PDF/CSV/text upload", strong: true },
      },
    },
    {
      id: "ask",
      capability: "Ask AI about your cash flow",
      category: "forecast",
      cells: {
        ynab: { text: "—" },
        mint: { text: "Limited" },
        spreadsheets: { text: "—" },
        ours: { text: "✓ Ask Kashu", strong: true },
      },
    },
    {
      id: "kinzo",
      capability: "Driving / fuel cost hooks",
      category: "life",
      cells: {
        ynab: { text: "—" },
        mint: { text: "—" },
        spreadsheets: { text: "—" },
        ours: { text: "✓ KINZO AI → fuel estimates in Twin", strong: true },
      },
    },
    {
      id: "twin",
      capability: "Personal Digital Twin context",
      category: "life",
      cells: {
        ynab: { text: "—" },
        mint: { text: "—" },
        spreadsheets: { text: "—" },
        ours: { text: "✓ MyMotiveLife Pro suite", strong: true },
      },
    },
  ],
  alternatives: [
    {
      id: "ynab",
      name: "YNAB",
      tag: "Envelope method",
      whyChoose:
        "The gold standard for zero-based budgeting — every dollar assigned, strong community, and proven habit change.",
      bestFor: "Households committed to envelope discipline and intentional spending.",
      limit: "Less focused on payday timing collisions and suite-wide Life OS integration.",
    },
    {
      id: "monarch",
      name: "Monarch Money",
      tag: "Modern aggregator",
      whyChoose:
        "Polished bank-sync budgeting with couples collaboration — a strong Mint successor for tracking-first users.",
      bestFor: "Couples who want automatic categorization and shared dashboards.",
      limit: "Bank connection is central; less emphasis on manual Safe to Spend without sync.",
    },
    {
      id: "copilot",
      name: "Copilot Money",
      tag: "iOS-native tracking",
      whyChoose: "Beautiful iPhone-first budgeting with smart categorization and subscription tracking.",
      bestFor: "Apple users who want sleek automatic tracking.",
      limit: "Platform and sync expectations differ from timing-first manual forecasting.",
    },
    {
      id: "rocket",
      name: "Rocket Money",
      tag: "Save & cancel",
      whyChoose: "Finds subscriptions, negotiates bills, and surfaces savings opportunities.",
      bestFor: "People optimizing recurring spend and cancellations.",
      limit: "Not a full Safe to Spend / payday collision engine.",
    },
    {
      id: "goodbudget",
      name: "Goodbudget",
      tag: "Digital envelopes",
      whyChoose: "Simple envelope budgeting without bank linking — familiar to YNAB migrants.",
      bestFor: "Envelope fans who want a lighter-weight tool.",
      limit: "Limited forward radar and Life OS integration.",
    },
    {
      id: "spreadsheets",
      name: "Spreadsheets",
      tag: "Full control",
      whyChoose: "Total flexibility — your formulas, your categories, no subscription.",
      bestFor: "Spreadsheet power users with time to maintain models.",
      limit: "No automatic bill learning, AI, or suite hooks without heavy DIY.",
    },
    {
      id: "kashu",
      name: KASHU_PRODUCT_NAME,
      tag: "Cash-Flow Intelligence",
      whyChoose:
        "Safe to Spend after obligations and your safety floor — statement upload, Payday Mode, Can I Afford, and hooks from KINZO, DayO, and UPLIFT. Included in MyMotiveLife Pro.",
      bestFor: "People who want timing-aware clarity without handing over bank credentials.",
      limit: "Not competing on subscription cancellation or investment tracking.",
      href: KASHU_PAGE_PATH,
      featured: true,
    },
  ],
  chooseTraditional: {
    title: "Choose a traditional budget app if…",
    body: "Your priority is envelope discipline, automatic bank categorization, investment tracking, or bill negotiation services.",
  },
  chooseOurs: {
    title: `Choose ${KASHU_PRODUCT_NAME} if…`,
    body: "You want to know what's safe to spend today — after bills, buffers, and payday timing — with optional Life OS context and no required bank login.",
  },
  ctaEyebrow: KASHU_PRODUCT_NAME,
  ctaHeadline: "The bank shows what you have.",
  ctaTagline: "Kashu shows what is yours to use.",
  ctaDetail:
    "Safe to Spend is included with MyMotiveLife Pro — alongside your Digital Twin, KINZO AI, Vitalu, and the full suite.",
  primaryCta: { href: KASHU_APP_PATH, label: "Open Kashu" },
  secondaryCta: { href: KASHU_PAGE_PATH, label: `Explore ${KASHU_PRODUCT_NAME}` },
  disclaimerProductName: KASHU_PRODUCT_NAME,
};
