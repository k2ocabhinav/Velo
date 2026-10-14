import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";
import { MOTION_SAFE_PULSE_CLASS } from "./motion-classes";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      aria-hidden="true"
      className={cn(
        `${MOTION_SAFE_PULSE_CLASS} rounded-md bg-[hsl(var(--color-surface-hover))]`,
        className
      )}
    />
  );
}
