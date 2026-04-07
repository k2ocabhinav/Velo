import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import { cn } from "../lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, error, hint, label, ...props },
  ref
) {
  return (
    <label className="flex w-full flex-col gap-1.5">
      {label ? (
        <span className="text-sm font-medium text-[hsl(var(--color-foreground))]">
          {label}
        </span>
      ) : null}
      <input
        ref={ref}
        {...props}
        className={cn(
          "h-10 w-full rounded-md border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] px-3 text-sm text-[hsl(var(--color-foreground))] shadow-sm outline-none transition-colors placeholder:text-[hsl(var(--color-placeholder))] focus:border-[hsl(var(--color-primary))] focus:ring-2 focus:ring-[hsl(var(--color-ring))]",
          error && "border-[hsl(var(--color-danger))] focus:border-[hsl(var(--color-danger))] focus:ring-[hsl(var(--color-danger))]/20",
          className
        )}
      />
      {error ? (
        <span className="text-sm text-[hsl(var(--color-danger))]">{error}</span>
      ) : hint ? (
        <span className="text-sm text-[hsl(var(--color-muted))]">{hint}</span>
      ) : null}
    </label>
  );
});
