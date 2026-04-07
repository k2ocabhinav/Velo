import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";
import { Spinner } from "../feedback/spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[hsl(var(--color-primary))] text-[hsl(var(--color-primary-fg))] hover:bg-[hsl(var(--color-primary-hover))]",
  secondary:
    "bg-[hsl(var(--color-surface-hover))] text-[hsl(var(--color-foreground))] hover:bg-[hsl(var(--color-surface-active))]",
  ghost:
    "bg-transparent text-[hsl(var(--color-foreground))] hover:bg-[hsl(var(--color-surface-hover))]",
  danger:
    "bg-[hsl(var(--color-danger))] text-white hover:opacity-90"
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-base"
};

export function Button({
  children,
  className,
  loading = false,
  startIcon,
  endIcon,
  size = "md",
  type = "button",
  variant = "primary",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md border border-transparent font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-ring))] disabled:pointer-events-none disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {loading ? <Spinner className="size-4" /> : startIcon}
      <span className="min-w-0 truncate">{children}</span>
      {!loading ? endIcon : null}
    </button>
  );
}
