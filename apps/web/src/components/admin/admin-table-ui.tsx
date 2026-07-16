"use client";

import { useId, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronRight } from "lucide-react";

export type SortDir = "asc" | "desc";

export function sortRows<T>(rows: T[], key: keyof T, dir: SortDir): T[] {
  const mul = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1 * mul;
    if (bv == null) return -1 * mul;
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * mul;
    if (typeof av === "boolean" && typeof bv === "boolean") {
      return (Number(av) - Number(bv)) * mul;
    }
    return String(av).localeCompare(String(bv), undefined, { sensitivity: "base" }) * mul;
  });
}

export function SortHeader({
  label,
  active,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  align?: "left" | "right";
}) {
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={`pb-2 pr-3 ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 text-forward-400 hover:text-forward-100"
      >
        {label}
        <Icon size={12} className={active ? "text-forward-200" : "text-forward-600"} />
      </button>
    </th>
  );
}

export function useSortState<K extends string>(
  initialKey: K,
  initialDir: SortDir = "desc",
): {
  key: K;
  dir: SortDir;
  toggle: (next: K) => void;
} {
  const [key, setKey] = useState<K>(initialKey);
  const [dir, setDir] = useState<SortDir>(initialDir);
  return {
    key,
    dir,
    toggle: (next: K) => {
      if (next === key) {
        setDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setKey(next);
        setDir("desc");
      }
    },
  };
}

/** Collapsible block for dense admin tables/sections. */
export function CollapsibleBlock({
  title,
  subtitle,
  count,
  defaultOpen = true,
  storageKey,
  headerRight,
  children,
}: {
  title: string;
  subtitle?: string;
  count?: number;
  defaultOpen?: boolean;
  /** Persist open/closed in sessionStorage when set */
  storageKey?: string;
  headerRight?: ReactNode;
  children: ReactNode;
}) {
  const reactId = useId();
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined" || !storageKey) return defaultOpen;
    try {
      const raw = sessionStorage.getItem(`admin-collapse:${storageKey}`);
      if (raw === "0") return false;
      if (raw === "1") return true;
    } catch {
      /* ignore */
    }
    return defaultOpen;
  });

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      if (storageKey) {
        try {
          sessionStorage.setItem(`admin-collapse:${storageKey}`, next ? "1" : "0");
        } catch {
          /* ignore */
        }
      }
      return next;
    });
  }

  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <div className="mb-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={reactId}
          className="flex min-w-0 items-center gap-2 text-left"
        >
          <Chevron size={16} className="shrink-0 text-forward-500" />
          <span className="text-xs font-semibold uppercase tracking-wider text-forward-500">
            {title}
          </span>
          {typeof count === "number" ? (
            <span className="rounded bg-forward-800 px-1.5 py-0.5 text-[10px] text-forward-300">
              {count}
            </span>
          ) : null}
        </button>
        {headerRight}
      </div>
      {subtitle && open ? (
        <p className="mb-2 ml-6 text-[11px] text-forward-600">{subtitle}</p>
      ) : null}
      {open ? <div id={reactId}>{children}</div> : null}
    </div>
  );
}
