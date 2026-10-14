import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://velo.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl, changeFrequency: "monthly", priority: 1 },
    { url: `${siteUrl}/privacy/`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteUrl}/terms/`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
