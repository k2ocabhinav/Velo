export const veloTailwindTheme = {
  colors: {
    background: "hsl(var(--color-background) / <alpha-value>)",
    surface: "hsl(var(--color-surface) / <alpha-value>)",
    surfaceHover: "hsl(var(--color-surface-hover) / <alpha-value>)",
    surfaceActive: "hsl(var(--color-surface-active) / <alpha-value>)",
    elevated: "hsl(var(--color-elevated) / <alpha-value>)",
    foreground: "hsl(var(--color-foreground) / <alpha-value>)",
    muted: "hsl(var(--color-muted) / <alpha-value>)",
    placeholder: "hsl(var(--color-placeholder) / <alpha-value>)",
    primary: "hsl(var(--color-primary) / <alpha-value>)",
    primaryHover: "hsl(var(--color-primary-hover) / <alpha-value>)",
    primaryFg: "hsl(var(--color-primary-fg) / <alpha-value>)",
    accent: "hsl(var(--color-accent) / <alpha-value>)",
    accentFg: "hsl(var(--color-accent-fg) / <alpha-value>)",
    success: "hsl(var(--color-success) / <alpha-value>)",
    warning: "hsl(var(--color-warning) / <alpha-value>)",
    danger: "hsl(var(--color-danger) / <alpha-value>)",
    info: "hsl(var(--color-info) / <alpha-value>)",
    border: "hsl(var(--color-border) / <alpha-value>)",
    borderHover: "hsl(var(--color-border-hover) / <alpha-value>)",
    ring: "hsl(var(--color-ring) / <alpha-value>)"
  },
  borderRadius: {
    sm: "var(--radius-sm)",
    md: "var(--radius-md)",
    lg: "var(--radius-lg)",
    xl: "var(--radius-xl)",
    full: "var(--radius-full)"
  },
  boxShadow: {
    sm: "var(--shadow-sm)",
    md: "var(--shadow-md)",
    lg: "var(--shadow-lg)",
    xl: "var(--shadow-xl)",
    inner: "var(--shadow-inner)"
  },
  fontFamily: {
    sans: "var(--font-body)",
    display: "var(--font-display)",
    mono: "var(--font-mono)"
  }
} as const;

const veloPreset = {
  theme: {
    extend: veloTailwindTheme
  }
};

export default veloPreset;
