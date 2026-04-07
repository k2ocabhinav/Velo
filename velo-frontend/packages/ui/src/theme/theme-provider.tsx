import type { CSSProperties, ReactNode } from "react";
import { cn } from "../lib/cn";
import { resolveThemeTokens, tokensToStyle, type TenantThemeInput } from "./tenant-resolver";

export interface ThemeProviderProps {
  children: ReactNode;
  theme?: TenantThemeInput;
  className?: string;
  style?: CSSProperties;
}

export function ThemeProvider({ children, className, style, theme }: ThemeProviderProps) {
  const tokens = resolveThemeTokens(theme);

  return (
    <div
      data-velo-theme
      className={cn(tokens.darkMode && "velo-theme-dark", className)}
      style={{ ...tokensToStyle(tokens), ...style } as CSSProperties}
    >
      {children}
    </div>
  );
}
