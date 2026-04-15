export const fontConfig = {
  display: {
    family: "Barlow Condensed" as const,
    weights: ["800", "900"] as const,
    variable: "--font-display",
  },
  body: {
    family: "Inter" as const,
    weights: ["400", "500", "600", "700"] as const,
    variable: "--font-body",
  },
};
