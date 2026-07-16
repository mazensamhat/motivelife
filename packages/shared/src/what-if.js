function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}
/** Client-side what-if projection aligned with life-finance-engine retirement math. */
export function projectWhatIf(base, adjustments) {
    const takeHome = Math.max(0, base.monthlyTakeHome + adjustments.monthlyIncomeDelta);
    const fixed = Math.max(0, base.fixedMonthlyExpenses - adjustments.monthlySpendingCut);
    const investments = Math.max(0, base.monthlyInvestments + adjustments.monthlyInvestmentDelta);
    const available = Math.max(0, takeHome - fixed - investments);
    const yearsLeft = Math.max(1, base.targetRetirementAge - base.currentAge);
    const extraMonthlyToNestEgg = adjustments.monthlyInvestmentDelta + adjustments.monthlySpendingCut * 0.5;
    const boostedBalance = base.retirementBalance + extraMonthlyToNestEgg * 12 * Math.min(yearsLeft, 10);
    const progress = base.nestEggTarget > 0 ? boostedBalance / base.nestEggTarget : 0;
    const onTrack = progress >= (base.currentAge >= base.targetRetirementAge - 10 ? 0.7 : 0.4);
    const projectedAge = onTrack
        ? base.targetRetirementAge
        : Math.min(75, base.targetRetirementAge +
            Math.max(1, Math.round((1 - progress) * yearsLeft * 0.6)));
    let headline = `You'd have ${formatUsd(available)}/mo available after fixed costs and investing.`;
    if (projectedAge < base.targetRetirementAge + 2) {
        headline += ` Retirement projection improves to age ${projectedAge}.`;
    }
    else if (adjustments.monthlyIncomeDelta > 0 || adjustments.monthlyInvestmentDelta > 0) {
        headline += ` Projected retirement age ${projectedAge} (target ${base.targetRetirementAge}).`;
    }
    return {
        monthlyTakeHome: takeHome,
        availableMonthly: available,
        monthlyInvestments: investments,
        projectedRetirementAge: projectedAge,
        targetRetirementAge: base.targetRetirementAge,
        onTrack,
        retirementProgressPercent: clamp(Math.round(progress * 100), 0, 100),
        headline,
    };
}
function formatUsd(n) {
    return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
