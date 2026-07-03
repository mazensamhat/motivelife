import { estimateActionMinutes, estimateActionReward } from "@/lib/action-rewards";

export function DomainItemActionStrip({
  title,
  domain,
  actionLabel,
  progress,
}: {
  title: string;
  domain: string;
  actionLabel: string;
  progress?: number | null;
}) {
  const minutes = estimateActionMinutes(title);
  const reward = estimateActionReward(title, domain);

  return (
    <div className="mt-3 rounded-lg border border-forward-100 bg-forward-50/80 px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-forward-400">Best next action</p>
      <p className="mt-0.5 text-sm font-semibold text-forward-900">{actionLabel}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-forward-500">
        {progress != null ? <span>{progress}%</span> : null}
        <span>{minutes} min</span>
        <span className="font-semibold text-brand-green">+{reward} Life Score</span>
      </div>
    </div>
  );
}
