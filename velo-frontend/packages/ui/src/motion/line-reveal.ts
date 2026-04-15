import type { Variants } from "motion/react";
import { power3Out } from "./easings";

export const lineRevealContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
    },
  },
};

export const lineRevealItem: Variants = {
  hidden: { y: "110%", opacity: 0 },
  visible: {
    y: "0%",
    opacity: 1,
    transition: { duration: 0.7, ease: power3Out },
  },
};
