"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";

export function FadeIn({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.0, 0.0, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}
