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
      className={cn("stat-card", className)}
      data-tone={tone}
    >
      <p className="stat-card-title">{title}</p>
      <div className="stat-card-value-row">
        <div className="stat-card-value">
          {value}
        </div>
        {delta ? (
          <div className="stat-card-delta">
            {delta}
          </div>
        ) : null}
      </div>
      {helperText ? (
        <p className="stat-card-helper">{helperText}</p>
      ) : null}
    </section>
  );
}
