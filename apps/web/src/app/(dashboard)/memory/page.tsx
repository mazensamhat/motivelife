import { MemoryHub } from "@/components/memory-hub";

export default function MemoryPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-forward-900">Memory</h1>
        <p className="mt-1 text-forward-500">
          Your permanent life story — moments, replay, weekly letters, and what MotiveLife remembers.
        </p>
      </div>

      <MemoryHub />
    </div>
  );
}
