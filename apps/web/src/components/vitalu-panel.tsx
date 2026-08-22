"use client";

import { cn } from "@/lib/utils";
import type { VitaluNavId } from "@/components/vitalu-dashboard-shell";

/** Hide panel when the active sidebar section is not in `ids`. Keeps mount state for forms. */
export function VitaluPanel({
  section,
  ids,
  className,
  children,
}: {
  section: VitaluNavId;
  ids: VitaluNavId[];
  className?: string;
  children: React.ReactNode;
}) {
  const visible = ids.includes(section);
  return (
    <div
      className={cn("space-y-6", !visible && "hidden", className)}
      hidden={!visible}
      aria-hidden={!visible}
    >
      {children}
    </div>
  );
}
