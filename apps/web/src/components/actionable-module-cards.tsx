"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowRight, Check, GripVertical } from "lucide-react";
import type { LifeModuleId, ModuleCardPayload } from "@forward/shared";
import { MODULE_TO_SLUG } from "@/lib/module-slug-map";
import { cn } from "@/lib/utils";

function SortableModuleCard({
  card,
  saving,
  onDone,
  doneFlash,
}: {
  card: ModuleCardPayload;
  saving: boolean;
  onDone: (card: ModuleCardPayload) => void;
  doneFlash: string | null;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "rounded-2xl border border-forward-200 bg-white shadow-sm",
        isDragging && "z-10 ring-2 ring-brand-blue/30",
        saving && "opacity-70"
      )}
    >
      <div className="flex items-center gap-1 border-b border-forward-100 px-2 py-1">
        <button
          type="button"
          className="cursor-grab touch-none rounded-lg p-1.5 text-forward-400 hover:text-forward-600 active:cursor-grabbing"
          aria-label={`Reorder ${card.label}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <span className="text-lg">{card.emoji}</span>
        <span className="font-semibold text-forward-900">{card.label}</span>
        <span className="ml-auto text-lg font-bold tabular-nums text-forward-900">
          {card.progress}%
        </span>
      </div>
      <div className="px-4 py-3">
        <div className="h-1.5 overflow-hidden rounded-full bg-forward-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-blue to-brand-cyan transition-all"
            style={{ width: `${card.progress}%` }}
          />
        </div>
        <p className="mt-3 text-sm text-forward-600">&ldquo;{card.insight}&rdquo;</p>
        {doneFlash === card.id ? (
          <p className="mt-3 text-sm font-semibold text-brand-green">Done · +3 Life Score</p>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onDone(card)}
              className="inline-flex items-center gap-1 text-sm font-semibold text-brand-green hover:underline"
            >
              <Check className="h-3.5 w-3.5" />
              Done
            </button>
            <Link
              href={card.actionHref}
              className="inline-flex items-center gap-1 text-sm font-semibold text-brand-blue hover:underline"
            >
              {card.actionLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export function ActionableModuleCards({ cards: initial }: { cards: ModuleCardPayload[] }) {
  const [items, setItems] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [doneFlash, setDoneFlash] = useState<string | null>(null);

  useEffect(() => {
    setItems(initial);
  }, [initial]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function persistOrder(order: LifeModuleId[]) {
    setSaving(true);
    try {
      await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleOrder: order }),
      });
    } finally {
      setSaving(false);
    }
  }

  async function markDone(card: ModuleCardPayload) {
    const domain = MODULE_TO_SLUG[card.id];
    if (!domain) return;
    await fetch("/api/next-action/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        domain,
        title: card.actionTitle,
        actionHref: card.actionHref,
        entityId: card.entityId,
      }),
    });
    setDoneFlash(card.id);
    setTimeout(() => setDoneFlash(null), 2000);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIndex = prev.findIndex((m) => m.id === active.id);
      const newIndex = prev.findIndex((m) => m.id === over.id);
      const next = arrayMove(prev, oldIndex, newIndex);
      void persistOrder(next.map((m) => m.id));
      return next;
    });
  }

  if (items.length === 0) return null;

  return (
    <section id="modules">
      <p className="text-xs font-semibold uppercase tracking-widest text-forward-400">
        Life Modules
      </p>
      <p className="mt-1 text-sm text-forward-500">
        Progress, insight, one action — drag to reorder.
      </p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((c) => c.id)} strategy={rectSortingStrategy}>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {items.map((card) => (
              <SortableModuleCard
                key={card.id}
                card={card}
                saving={saving}
                onDone={markDone}
                doneFlash={doneFlash}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  );
}
