"use client";

import type { ReactNode } from "react";
import { motion, type Variants } from "motion/react";

export const staggerContainer: Variants = {
  animate: {
    transition: {
      staggerChildren: 0.04
    }
  }
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.0, 0.0, 0.2, 1] }
  }
};

export function Stagger({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div className={className} variants={staggerContainer} initial="initial" animate="animate">
      {children}
    </motion.div>
  );
}
