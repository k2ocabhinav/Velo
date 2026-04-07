"use client";

import type { ReactNode } from "react";
import { AnimatePresence } from "motion/react";

export function Presence({ children }: { children: ReactNode }) {
  return <AnimatePresence mode="wait">{children}</AnimatePresence>;
}
