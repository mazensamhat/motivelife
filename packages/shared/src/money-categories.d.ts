/** Categories shown in the monthly expense breakdown graph. */
export declare const MONEY_GRAPH_CATEGORIES: readonly [{
    readonly key: "home";
    readonly label: "Home";
    readonly color: "#0072ff";
}, {
    readonly key: "subscriptions";
    readonly label: "Subscriptions";
    readonly color: "#8B5CF6";
}, {
    readonly key: "bills";
    readonly label: "Bills & utilities";
    readonly color: "#F59E0B";
}, {
    readonly key: "living";
    readonly label: "Living expenses";
    readonly color: "#EC4899";
}, {
    readonly key: "debt";
    readonly label: "Debt payments";
    readonly color: "#EF4444";
}, {
    readonly key: "savings";
    readonly label: "Savings";
    readonly color: "#06B6D4";
}, {
    readonly key: "investments";
    readonly label: "Investments";
    readonly color: "#6366F1";
}, {
    readonly key: "retirement";
    readonly label: "Retirement";
    readonly color: "#14B8A6";
}, {
    readonly key: "available";
    readonly label: "Available";
    readonly color: "#00ff87";
}];
export type MoneyGraphCategoryKey = (typeof MONEY_GRAPH_CATEGORIES)[number]["key"];
export declare const MONEY_GRAPH_CATEGORY_COLORS: Record<MoneyGraphCategoryKey, string>;
/** Maps each money item type to a graph category. */
export declare const MONEY_TYPE_TO_GRAPH_CATEGORY: Record<MoneyItemType, MoneyGraphCategoryKey | null>;
export declare const COMMITMENT_MONEY_TYPES: readonly ["BILL", "HOUSING", "COMMITMENT", "SUBSCRIPTION", "LIVING_EXPENSE"];
export declare const ACCOUNT_MONEY_TYPES: readonly ["SAVINGS", "INVESTMENT", "RETIREMENT", "DEBT"];
export declare const MONEY_ITEM_TYPES: readonly ["HOUSING", "SUBSCRIPTION", "BILL", "LIVING_EXPENSE", "COMMITMENT", "DEBT", "SAVINGS", "INVESTMENT", "RETIREMENT"];
export type MoneyItemType = (typeof MONEY_ITEM_TYPES)[number];
export declare const MONEY_TYPE_LABELS: Record<MoneyItemType, string>;
/** Grouped options for the add-item form. */
export declare const MONEY_TYPE_GROUPS: {
    label: string;
    types: MoneyItemType[];
}[];
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
export declare function isCommitmentType(type: string): boolean;
export declare function graphCategoryForType(type: string): MoneyGraphCategoryKey | null;
/** Monthly cash-flow amount for graph aggregation. */
export declare function monthlyFlowAmount(item: {
    type: string;
    currentAmount: number;
    targetAmount: number | null;
    dueDay?: number | null;
}): number;
export declare function isBalanceAccountType(type: string): boolean;
