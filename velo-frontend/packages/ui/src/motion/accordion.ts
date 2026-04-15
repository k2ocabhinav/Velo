import type { Variants } from "motion/react";

export const accordionContent: Variants = {
  collapsed: {
    height: 0,
    opacity: 0,
    overflow: "hidden",
    transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] },
  },
  expanded: {
    height: "auto",
    opacity: 1,
    overflow: "hidden",
    transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] },
  },
};
