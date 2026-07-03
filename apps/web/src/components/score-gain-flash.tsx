"use client";

export function ScoreGainFlash({ amount }: { amount: number }) {
  return (
    <div className="score-gain-flash pointer-events-none absolute inset-x-0 top-1/2 z-20 flex justify-center" aria-hidden>
      <span className="text-lg font-bold text-brand-green">+{amount} Life Score</span>
    </div>
  );
}
