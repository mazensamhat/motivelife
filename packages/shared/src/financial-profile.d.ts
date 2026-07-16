export type FinancialPressureLevel = "low" | "moderate" | "high";
export interface FinancialProfilePayload {
    grossAnnualIncome: number | null;
    monthlyTakeHome: number | null;
    monthlyInvestments: number | null;
    retirementTargetAge: number | null;
    emergencyFundMonths: number | null;
    householdSize: number | null;
    setupComplete: boolean;
}
export interface MoneyHealthComponent {
    key: "cashFlow" | "savings" | "debt" | "investments" | "retirement";
    label: string;
    score: number;
    hint: string;
}
export interface LifeCapacitySnapshot {
    moneyCapacity: number;
    financialPressure: FinancialPressureLevel;
    fixedExpenseRatio: number;
}
export interface CostOfLifeSlice {
    key: string;
    label: string;
    amount: number;
    percent: number;
}
export type { ExpenseCategorySlice, ExpenseBreakdown } from "./money-categories";
import type { ExpenseBreakdown } from "./money-categories";
export interface RetirementScenario {
    id: string;
    label: string;
    action: string;
    projectedRetirementAge: number;
    impactLabel: string;
}
export interface UpcomingCommitment {
    id: string;
    title: string;
    amount: number;
    dueDay: number;
    daysUntil: number;
    status: "paid" | "due_soon" | "upcoming";
}
export interface CashflowWarning {
    text: string;
    severity: "warning" | "urgent";
    billTitle?: string;
    shortfall?: number;
}
export interface LifeFinanceSnapshot {
    profile: FinancialProfilePayload;
    monthlyTakeHome: number;
    fixedMonthlyExpenses: number;
    availableMonthly: number;
    /** Housing + bills + subscriptions + essentials — monthly must-haves */
    monthlySurvivalNumber: number;
    /** What's left after survival + planned savings this month */
    safeToSpend: number;
    cashflowWarnings: CashflowWarning[];
    recommendedInvestments: number;
    recommendedDiscretionary: number;
    totalSavings: number;
    totalInvestments: number;
    totalRetirement: number;
    totalDebt: number;
    costOfLife: CostOfLifeSlice[];
    expenseBreakdown: ExpenseBreakdown;
    lifeCapacity: LifeCapacitySnapshot;
    moneyHealth: {
        overall: number;
        components: MoneyHealthComponent[];
    };
    retirement: {
        targetAge: number;
        projectedAge: number;
        onTrack: boolean;
        headline: string;
        scenarios: RetirementScenario[];
    } | null;
    upcomingCommitments: UpcomingCommitment[];
    aiInsight: string;
    currentAge?: number | null;
    nestEggTarget?: number;
}
export declare const COMMITMENT_MONEY_TYPES: readonly ["BILL", "HOUSING", "COMMITMENT", "SUBSCRIPTION", "LIVING_EXPENSE"];
export declare const ACCOUNT_MONEY_TYPES: readonly ["SAVINGS", "INVESTMENT", "RETIREMENT", "DEBT"];
