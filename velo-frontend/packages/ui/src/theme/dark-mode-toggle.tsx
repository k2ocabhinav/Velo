"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "velo-theme";
const DARK_CLASS = "velo-theme-dark";

function getInitialTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: "light" | "dark") {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add(DARK_CLASS);
    root.setAttribute("data-theme", "dark");
  } else {
    root.classList.remove(DARK_CLASS);
    root.setAttribute("data-theme", "light");
  }
}

export function useDarkMode() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const initial = getInitialTheme();
    setTheme(initial);
    applyTheme(initial);
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem(STORAGE_KEY, next);
      applyTheme(next);
      return next;
    });
  }, []);

  return { theme, toggle, isDark: theme === "dark" };
}

export function DarkModeToggle({ className }: { className?: string }) {
  const { isDark, toggle } = useDarkMode();

  return (
    <button
      type="button"
      className={className}
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 36,
        height: 36,
        borderRadius: "var(--radius-md, 6px)",
        border: "1px solid hsl(var(--color-border, 210 12% 90%))",
        background: "transparent",
        cursor: "pointer",
        fontSize: 18,
        lineHeight: 1,
      }}
    >
      {isDark ? "\u2600\uFE0F" : "\u{1F319}"}
    </button>
  );
}
