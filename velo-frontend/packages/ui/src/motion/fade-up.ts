import type { Variants } from "motion/react";
import { power3Out } from "./easings";

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: power3Out },
  },
};
