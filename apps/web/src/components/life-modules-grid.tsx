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
import { GripVertical } from "lucide-react";
import type { LifeModuleId } from "@forward/shared";
import { cn } from "@/lib/utils";

export interface LifeModuleCard {
  id: string;
  label: string;
  emoji: string;
  href: string;
}

function SortableModule({
  mod,
  saving,
}: {
  mod: LifeModuleCard;
  saving: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: mod.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative flex items-center gap-2 rounded-xl border border-forward-200 bg-white shadow-sm transition-shadow",
        isDragging && "z-10 border-brand-blue/40 shadow-lg ring-2 ring-brand-blue/20",
        saving && "opacity-70"
      )}
    >
      <button
        type="button"
        className="flex shrink-0 cursor-grab touch-none items-center self-stretch rounded-l-xl px-2 text-forward-400 hover:bg-forward-50 hover:text-forward-600 active:cursor-grabbing"
        aria-label={`Reorder ${mod.label}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Link
        href={mod.href}
        className="flex min-w-0 flex-1 items-center gap-3 py-3 pr-4 text-sm font-medium text-forward-800 transition-colors hover:text-brand-blue"
      >
        <span className="text-lg">{mod.emoji}</span>
        <span className="truncate">{mod.label.replace(" Module", "")}</span>
      </Link>
    </div>
  );
}

export function LifeModulesGrid({
  modules: initial,
  moduleOrder: initialOrder,
}: {
  modules: LifeModuleCard[];
  moduleOrder: LifeModuleId[];
}) {
  const [items, setItems] = useState(initial);
  const [saving, setSaving] = useState(false);

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

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setItems((prev) => {
      const oldIndex = prev.findIndex((m) => m.id === active.id);
      const newIndex = prev.findIndex((m) => m.id === over.id);
      const next = arrayMove(prev, oldIndex, newIndex);
      void persistOrder(next.map((m) => m.id as LifeModuleId));
      return next;
    });
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-forward-500">
        No modules active.{" "}
        <Link href="/settings" className="text-brand-blue hover:underline">
          Add modules in Settings
        </Link>
      </p>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-forward-400">
          Your Life Modules
        </p>
        {saving && <span className="text-xs text-forward-400">Saving order…</span>}
      </div>
      <p className="mt-1 text-xs text-forward-500">Drag to reorder — your home screen, your life.</p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((m) => m.id)} strategy={rectSortingStrategy}>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {items.map((mod) => (
              <SortableModule key={mod.id} mod={mod} saving={saving} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <p className="mt-2 text-xs text-forward-500">
        <Link href="/settings" className="text-brand-blue hover:underline">
          Customize modules
        </Link>{" "}
        in Settings
      </p>
    </div>
  );
}
