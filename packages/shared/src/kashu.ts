/** Kashu — Cash-Flow Intelligence shared types (no bank connect). */

export const KASHU_PAY_FREQUENCIES = [
  "WEEKLY",
  "BIWEEKLY",
  "SEMI_MONTHLY",
  "MONTHLY",
  "IRREGULAR",
] as const;
export type KashuPayFrequency = (typeof KASHU_PAY_FREQUENCIES)[number];

export const KASHU_ITEM_FREQUENCIES = [
  "WEEKLY",
  "BIWEEKLY",
  "SEMI_MONTHLY",
  "MONTHLY",
  "ANNUAL",
  "ONE_OFF",
] as const;
export type KashuItemFrequency = (typeof KASHU_ITEM_FREQUENCIES)[number];

export const KASHU_PRIORITIES = [
  "MANDATORY",
  "NECESSARY",
  "DISCRETIONARY",
  "LIFESTYLE",
] as const;
export type KashuPriority = (typeof KASHU_PRIORITIES)[number];

export const KASHU_TX_CLASSIFICATIONS = [
  "income",
  "obligation",
  "necessary",
  "lifestyle",
  "discretionary",
  "transfer",
  "refund",
  "reimbursement",
  "emergency",
  "other",
] as const;
export type KashuTxClassification = (typeof KASHU_TX_CLASSIFICATIONS)[number];

export type KashuCashStatus = "green" | "yellow" | "red";

export interface KashuProfileFields {
  liquidBalance: number | null;
  safetyFloor: number;
  emergencyReserve: number;
  payFrequency: KashuPayFrequency | null;
  nextPayday: string | null;
  paydayAnchorDay: number | null;
  lifestyleBurnDaily: number;
  /** Typical net monthly take-home used for payday modeling. */
  monthlyTakeHome: number | null;
  transitionJson: string | null;
}

export interface KashuRadarEvent {
  id: string;
  date: string; // YYYY-MM-DD
  kind: "income" | "obligation" | "lifestyle" | "collision" | "payday";
  title: string;
  amount: number;
  balanceAfter: number;
  status: KashuCashStatus;
  confidence?: number;
  autoPay?: boolean;
  priority?: KashuPriority;
  fundingPayday?: string | null;
}

export interface KashuDayProjection {
  date: string;
  startingBalance: number;
  income: number;
  obligations: number;
  lifestyleBurn: number;
  endingBalance: number;
  availableAboveFloor: number;
  status: KashuCashStatus;
  events: KashuRadarEvent[];
}

export interface KashuCollision {
  date: string;
  title: string;
  shortfall: number;
  projectedBalance: number;
  causeEventId?: string;
}

export interface KashuBillWave {
  id: string;
  /** Display label e.g. "Big-pay wave" or "Pay cycle · 2026-08-22" */
  label: string;
  fundingPayday: string | null;
  totalObligations: number;
  eventIds: string[];
  status: KashuCashStatus;
}

export interface KashuTimingScenario {
  billId: string;
  billTitle: string;
  currentDueDay: number;
  moveToDay: number;
  projectedLow: number;
  recommended: boolean;
  note: string;
}

export interface KashuForecast {
  asOf: string;
  horizonDays: number;
  liquidBalance: number;
  safetyFloor: number;
  emergencyReserve: number;
  reservedObligations: number;
  /** Bank Balance − Reserved − Safety Floor (never negative display; shortfall separate) */
  safeToSpend: number;
  safeToSpendShortfall: number;
  projectedLow: number;
  projectedLowDate: string | null;
  nextPayday: string | null;
  daysUntilPayday: number | null;
  status: KashuCashStatus;
  days: KashuDayProjection[];
  radar: KashuRadarEvent[];
  collisions: KashuCollision[];
  billWaves: KashuBillWave[];
  timingScenarios: KashuTimingScenario[];
  message: string;
  payFrequency: KashuPayFrequency | null;
}

export interface KashuParsedTransaction {
  postedAt: string;
  description: string;
  merchantNorm: string;
  amount: number;
  direction: "debit" | "credit";
  balanceAfter?: number | null;
  classification: KashuTxClassification;
  isTransfer?: boolean;
  isOneOff?: boolean;
}

export interface KashuParsedRecurring {
  title: string;
  merchantNorm: string;
  amount: number;
  amountMin?: number;
  amountMax?: number;
  frequency: KashuItemFrequency;
  intervalDays?: number;
  nextDueDate?: string | null;
  priority: KashuPriority;
  confidence: number;
  autoPay?: boolean;
}

export interface KashuStatementParseResult {
  endingBalance?: number | null;
  accountLabel?: string | null;
  paydayGuess?: string | null;
  payFrequencyGuess?: KashuPayFrequency | null;
  transactions: KashuParsedTransaction[];
  recurring: KashuParsedRecurring[];
  incomeRhythmNotes?: string | null;
  summary?: string | null;
}

export interface KashuTransitionState {
  oldAccountLabel: string;
  newAccountLabel: string;
  payrollMoved: boolean;
  oldOverdraftBalance: number;
  notes: string;
  pads: Array<{
    id: string;
    title: string;
    amount: number;
    clearedOnNew: boolean;
  }>;
}

export interface KashuWhatIfRequest {
  spendToday?: number;
  bonusDelta?: number;
  moveBillId?: string;
  moveBillToDay?: number;
  lowerIncomeBy?: number;
}

export interface KashuWhatIfResult {
  baseline: Pick<KashuForecast, "safeToSpend" | "projectedLow" | "projectedLowDate" | "message">;
  scenario: Pick<KashuForecast, "safeToSpend" | "projectedLow" | "projectedLowDate" | "message" | "collisions">;
  explanation: string;
}
