/** Categories shown in the monthly expense breakdown graph. */
export const MONEY_GRAPH_CATEGORIES = [
  { key: "home", label: "Home", color: "#0072ff" },
  { key: "subscriptions", label: "Subscriptions", color: "#8B5CF6" },
  { key: "bills", label: "Bills & utilities", color: "#F59E0B" },
  { key: "living", label: "Living expenses", color: "#EC4899" },
  { key: "debt", label: "Debt payments", color: "#EF4444" },
  { key: "savings", label: "Savings", color: "#06B6D4" },
  { key: "investments", label: "Investments", color: "#6366F1" },
  { key: "retirement", label: "Retirement", color: "#14B8A6" },
  { key: "available", label: "Available", color: "#00ff87" },
] as const;

export type MoneyGraphCategoryKey = (typeof MONEY_GRAPH_CATEGORIES)[number]["key"];

export const MONEY_GRAPH_CATEGORY_COLORS: Record<MoneyGraphCategoryKey, string> =
  Object.fromEntries(MONEY_GRAPH_CATEGORIES.map((c) => [c.key, c.color])) as Record<
    MoneyGraphCategoryKey,
    string
  >;

/** Maps each money item type to a graph category. */
export const MONEY_TYPE_TO_GRAPH_CATEGORY: Record<MoneyItemType, MoneyGraphCategoryKey | null> = {
  HOUSING: "home",
  SUBSCRIPTION: "subscriptions",
  BILL: "bills",
  LIVING_EXPENSE: "living",
  COMMITMENT: "living",
  DEBT: "debt",
  SAVINGS: "savings",
  INVESTMENT: "investments",
  RETIREMENT: "retirement",
};

export const COMMITMENT_MONEY_TYPES = [
  "BILL",
  "HOUSING",
  "COMMITMENT",
  "SUBSCRIPTION",
  "LIVING_EXPENSE",
] as const;

export const ACCOUNT_MONEY_TYPES = ["SAVINGS", "INVESTMENT", "RETIREMENT", "DEBT"] as const;

export const MONEY_ITEM_TYPES = [
  "HOUSING",
  "SUBSCRIPTION",
  "BILL",
  "LIVING_EXPENSE",
  "COMMITMENT",
  "DEBT",
  "SAVINGS",
  "INVESTMENT",
  "RETIREMENT",
] as const;

export type MoneyItemType = (typeof MONEY_ITEM_TYPES)[number];

export const MONEY_TYPE_LABELS: Record<MoneyItemType, string> = {
  HOUSING: "Home — mortgage / rent",
  SUBSCRIPTION: "Subscription",
  BILL: "Bill / utility",
  LIVING_EXPENSE: "Living expense",
  COMMITMENT: "Other monthly commitment",
  DEBT: "Debt payment",
  SAVINGS: "Savings contribution",
  INVESTMENT: "Investment contribution",
  RETIREMENT: "Retirement contribution",
};

/** Grouped options for the add-item form. */
export const MONEY_TYPE_GROUPS: {
  label: string;
  types: MoneyItemType[];
}[] = [
  { label: "Home", types: ["HOUSING"] },
  { label: "Subscriptions & bills", types: ["SUBSCRIPTION", "BILL"] },
  { label: "Living expenses", types: ["LIVING_EXPENSE", "COMMITMENT"] },
  { label: "Debt", types: ["DEBT"] },
  { label: "Saving & investing", types: ["SAVINGS", "INVESTMENT", "RETIREMENT"] },
];

export interface ExpenseCategorySlice {
  key: MoneyGraphCategoryKey;
  label: string;
  amount: number;
  percentOfIncome: number;
  color: string;
}

export interface ExpenseBreakdown {
  monthlyIncome: number;
  categories: ExpenseCategorySlice[];
  available: number;
}

export function isCommitmentType(type: string) {
  return (COMMITMENT_MONEY_TYPES as readonly string[]).includes(type);
}

export function graphCategoryForType(type: string): MoneyGraphCategoryKey | null {
  if (!(type in MONEY_TYPE_TO_GRAPH_CATEGORY)) return null;
  return MONEY_TYPE_TO_GRAPH_CATEGORY[type as MoneyItemType];
}

/** Monthly cash-flow amount for graph aggregation. */
export function monthlyFlowAmount(item: {
  type: string;
  currentAmount: number;
  targetAmount: number | null;
  dueDay?: number | null;
}): number {
  if (isCommitmentType(item.type)) return item.currentAmount;

  if (item.type === "DEBT") {
    if (item.targetAmount) return Math.max(item.currentAmount * 0.02, 50);
    return Math.max(item.currentAmount * 0.02, 50);
  }

  if (item.type === "SAVINGS" || item.type === "INVESTMENT" || item.type === "RETIREMENT") {
    if (item.dueDay != null) return item.currentAmount;
    return 0;
  }

  return 0;
}

export function isBalanceAccountType(type: string) {
  return (ACCOUNT_MONEY_TYPES as readonly string[]).includes(type);
}
