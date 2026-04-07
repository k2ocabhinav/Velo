import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

export interface StatusBadgeProps {
  children: ReactNode;
  tone?: StatusTone;
  className?: string;
}

const toneClasses: Record<StatusTone, string> = {
  neutral: "bg-[hsl(var(--color-surface-hover))] text-[hsl(var(--color-foreground))]",
  info: "bg-[hsl(var(--color-info))]/15 text-[hsl(var(--color-info))]",
  success: "bg-[hsl(var(--color-success))]/15 text-[hsl(var(--color-success))]",
  warning: "bg-[hsl(var(--color-warning))]/15 text-[hsl(var(--color-warning))]",
  danger: "bg-[hsl(var(--color-danger))]/15 text-[hsl(var(--color-danger))]"
};

export function StatusBadge({ children, className, tone = "neutral" }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium",
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
