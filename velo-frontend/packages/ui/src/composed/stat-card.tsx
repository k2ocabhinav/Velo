import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export interface StatCardProps {
  title: string;
  value: ReactNode;
  helperText?: ReactNode;
  delta?: ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
  className?: string;
}

const toneClasses: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "border-[hsl(var(--color-border))]",
  success: "border-[hsl(var(--color-success))]/30",
  warning: "border-[hsl(var(--color-warning))]/30",
  danger: "border-[hsl(var(--color-danger))]/30"
};

export function StatCard({
  className,
  delta,
  helperText,
  tone = "default",
  title,
  value
}: StatCardProps) {
  return (
    <section
      className={cn(
        "rounded-lg border bg-[hsl(var(--color-surface))] p-4 shadow-sm",
        toneClasses[tone],
        className
      )}
    >
      <p className="text-sm font-medium text-[hsl(var(--color-muted))]">{title}</p>
      <div className="mt-2 flex items-end justify-between gap-4">
        <div className="min-w-0 text-2xl font-semibold tracking-tight text-[hsl(var(--color-foreground))]">
          {value}
        </div>
        {delta ? (
          <div className="shrink-0 text-sm font-medium text-[hsl(var(--color-primary))]">
            {delta}
          </div>
        ) : null}
      </div>
      {helperText ? (
        <p className="mt-2 text-sm text-[hsl(var(--color-muted))]">{helperText}</p>
      ) : null}
    </section>
  );
}
