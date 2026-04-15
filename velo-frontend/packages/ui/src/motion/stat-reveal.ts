import type { Variants } from "motion/react";
import { power4Out } from "./easings";

export const statReveal: Variants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.6, ease: power4Out },
  },
};
