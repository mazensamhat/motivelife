/** Shared heuristics for action time + Life Score reward across domain UI */

export function estimateActionMinutes(title: string): number {
  if (/walk|stretch|meditat/i.test(title)) return 8;
  if (/workout|run|gym|fitness/i.test(title)) return 18;
  if (/resume|linkedin|apply|interview/i.test(title)) return 14;
  if (/budget|spend|subscription|bill|debt|save/i.test(title)) return 8;
  if (/call|message|mom|dad|family/i.test(title)) return 6;
  if (/learn|read|course|study/i.test(title)) return 20;
  return 12;
}

export function estimateActionReward(title: string, domain?: string): number {
  if (/apply|offer|resume|interview/i.test(title)) return 8;
  if (/pay|save|debt|subscription/i.test(title)) return 5;
  if (/workout|walk|health|protein|sleep/i.test(title)) return 5;
  if (/call|message|family/i.test(title)) return 6;
  if (domain === "career") return 4;
  if (domain === "money") return 3;
  if (domain === "health") return 5;
  return 4;
}

export function deriveMoneyActionLabel(title: string, type: string): string {
  if (type === "BILL") return "Review bill";
  if (type === "DEBT") return "Pay down";
  if (/emergency|save/i.test(title)) return "Add deposit";
  return "Review spending";
}

export function deriveHealthActionLabel(title: string, type: string): string {
  if (type === "FITNESS") return /workout|gym/i.test(title) ? "Start workout" : "Move today";
  if (type === "SLEEP") return "Protect sleep";
  if (type === "NUTRITION") return "Log nutrition";
  return "Check in";
}
