import { veloFonts } from "./fonts";

export type ThemeRadius = "sharp" | "rounded" | "pill";

export interface ThemeColors {
  primary: string;
  accent: string;
}

export interface ThemeFonts {
  display: string;
  body: string;
  mono: string;
}

export interface ThemeTokens {
  colors: {
    background: string;
    surface: string;
    surfaceHover: string;
    surfaceActive: string;
    elevated: string;
    foreground: string;
    muted: string;
    placeholder: string;
    primary: string;
    primaryHover: string;
    primaryFg: string;
    accent: string;
    accentFg: string;
    success: string;
    warning: string;
    danger: string;
    info: string;
    border: string;
    borderHover: string;
    ring: string;
    overlay: string;
  };
  fonts: ThemeFonts;
  radius: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
    full: string;
  };
  darkMode: boolean;
}

export interface TenantThemeInput {
  colors?: Partial<ThemeColors> & Partial<ThemeTokens["colors"]>;
  fonts?: Partial<ThemeFonts>;
  borderRadius?: ThemeRadius;
  darkMode?: boolean;
}

export const defaultThemeTokens: ThemeTokens = {
  colors: {
    background: "210 20% 98%",
    surface: "0 0% 100%",
    surfaceHover: "210 15% 95%",
    surfaceActive: "210 12% 90%",
    elevated: "0 0% 100%",
    foreground: "210 20% 10%",
    muted: "210 7% 50%",
    placeholder: "210 8% 65%",
    primary: "226 100% 55%",
    primaryHover: "226 100% 42%",
    primaryFg: "0 0% 100%",
    accent: "173 58% 39%",
    accentFg: "0 0% 100%",
    success: "142 71% 45%",
    warning: "38 92% 50%",
    danger: "0 84% 60%",
    info: "220 72% 50%",
    border: "210 12% 90%",
    borderHover: "210 10% 80%",
    ring: "220 72% 50% / 0.3",
    overlay: "210 25% 5% / 0.5"
  },
  fonts: veloFonts,
  radius: {
    sm: "4px",
    md: "6px",
    lg: "8px",
    xl: "8px",
    full: "9999px"
  },
  darkMode: false
};

export function resolveThemeTokens(input: TenantThemeInput = {}): ThemeTokens {
  const radiusMap: Record<ThemeRadius, ThemeTokens["radius"]> = {
    sharp: { sm: "2px", md: "4px", lg: "6px", xl: "6px", full: "9999px" },
    rounded: { sm: "4px", md: "6px", lg: "8px", xl: "8px", full: "9999px" },
    pill: { sm: "9999px", md: "9999px", lg: "9999px", xl: "9999px", full: "9999px" }
  };

  return {
    colors: {
      ...defaultThemeTokens.colors,
      ...input.colors
    },
    fonts: {
      ...defaultThemeTokens.fonts,
      ...input.fonts
    },
    radius: input.borderRadius ? radiusMap[input.borderRadius] : defaultThemeTokens.radius,
    darkMode: input.darkMode ?? defaultThemeTokens.darkMode
  };
}

export function tokensToStyle(tokens: ThemeTokens): Record<string, string> {
  return {
    "--color-background": tokens.colors.background,
    "--color-surface": tokens.colors.surface,
    "--color-surface-hover": tokens.colors.surfaceHover,
    "--color-surface-active": tokens.colors.surfaceActive,
    "--color-elevated": tokens.colors.elevated,
    "--color-foreground": tokens.colors.foreground,
    "--color-muted": tokens.colors.muted,
    "--color-placeholder": tokens.colors.placeholder,
    "--color-primary": tokens.colors.primary,
    "--color-primary-hover": tokens.colors.primaryHover,
    "--color-primary-fg": tokens.colors.primaryFg,
    "--color-accent": tokens.colors.accent,
    "--color-accent-fg": tokens.colors.accentFg,
    "--color-success": tokens.colors.success,
    "--color-warning": tokens.colors.warning,
    "--color-danger": tokens.colors.danger,
    "--color-info": tokens.colors.info,
    "--color-border": tokens.colors.border,
    "--color-border-hover": tokens.colors.borderHover,
    "--color-ring": tokens.colors.ring,
    "--color-overlay": tokens.colors.overlay,
    "--radius-sm": tokens.radius.sm,
    "--radius-md": tokens.radius.md,
    "--radius-lg": tokens.radius.lg,
    "--radius-xl": tokens.radius.xl,
    "--radius-full": tokens.radius.full,
    "--font-display": tokens.fonts.display,
    "--font-body": tokens.fonts.body,
    "--font-mono": tokens.fonts.mono
  };
}
