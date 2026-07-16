export interface WhatIfAdjustments {
    monthlyIncomeDelta: number;
    monthlyInvestmentDelta: number;
    monthlySpendingCut: number;
}
export interface WhatIfProjection {
    monthlyTakeHome: number;
    availableMonthly: number;
    monthlyInvestments: number;
    projectedRetirementAge: number;
    targetRetirementAge: number;
    onTrack: boolean;
    retirementProgressPercent: number;
    headline: string;
}
/** Client-side what-if projection aligned with life-finance-engine retirement math. */
export declare function projectWhatIf(base: {
    monthlyTakeHome: number;
    fixedMonthlyExpenses: number;
    monthlyInvestments: number;
    retirementBalance: number;
    nestEggTarget: number;
    targetRetirementAge: number;
    currentAge: number;
}, adjustments: WhatIfAdjustments): WhatIfProjection;
