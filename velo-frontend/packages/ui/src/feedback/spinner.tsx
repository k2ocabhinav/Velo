import type { SVGProps } from "react";
import { cn } from "../lib/cn";
import { MOTION_SAFE_SPIN_CLASS } from "./motion-classes";

export function Spinner({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      role="status"
      aria-label="Loading"
      className={cn(MOTION_SAFE_SPIN_CLASS, className)}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="2"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
      </path>
    </svg>
  );
}
