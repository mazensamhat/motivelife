/** Shared types for SEO alternatives landing pages (/alternatives/*). */

export type ComparisonCategory = string;

export type ComparisonCell = {
  text: string;
  strong?: boolean;
  comingSoon?: boolean;
};

export type ComparisonColumn = {
  id: string;
  label: string;
  /** Highlight as “our product” column */
  ours?: boolean;
};

export type ComparisonRow = {
  id: string;
  capability: string;
  category: ComparisonCategory;
  cells: Record<string, ComparisonCell>;
};

export type ComparisonFilter = {
  id: "all" | ComparisonCategory;
  label: string;
  hint: string;
};

export type AlternativeProfile = {
  id: string;
  name: string;
  tag: string;
  whyChoose: string;
  bestFor: string;
  limit: string;
  href?: string;
  featured?: boolean;
};

export type AlternativesPageConfig = {
  path: string;
  navActiveLabel: string;
  productEyebrow: string;
  meta: {
    title: string;
    metaTitle: string;
    metaDescription: string;
    keywords: string[];
  };
  reviewed: string;
  heroSubtitle: string;
  keyDifference: string;
  strengthBands: { title: string; body: string }[];
  comparisonFilters: ComparisonFilter[];
  comparisonColumns: ComparisonColumn[];
  comparisonRows: ComparisonRow[];
  alternatives: AlternativeProfile[];
  chooseTraditional: { title: string; body: string };
  chooseOurs: { title: string; body: string };
  ctaEyebrow: string;
  ctaHeadline: string;
  ctaTagline: string;
  ctaDetail: string;
  primaryCta: { href: string; label: string };
  secondaryCta: { href: string; label: string };
  disclaimerProductName: string;
};
