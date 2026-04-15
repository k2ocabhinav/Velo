"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useMotionValue, animate } from "motion/react";

export function AnimatedCounter({
  target,
  suffix = "",
}: {
  target: number;
  suffix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });
  const motionVal = useMotionValue(0);
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    if (!isInView) return;

    const controls = animate(motionVal, target, {
      duration: 1.2,
      ease: [0.25, 0.1, 0.25, 1],
      onUpdate: (v) => setDisplay(Math.floor(v).toString()),
    });

    return () => controls.stop();
  }, [isInView, target, motionVal]);

  return (
    <span
      ref={ref}
      style={{
        fontFamily: 'var(--font-display), "Barlow Condensed", system-ui, sans-serif',
        fontWeight: 900,
        fontSize: "var(--text-heading-md)",
        lineHeight: 1,
        display: "block",
      }}
    >
      {display}{suffix}
    </span>
  );
}
