import process from "node:process";
import { URL } from "node:url";

function configuredApiOrigin(apiBaseUrl) {
  try {
    return new URL(apiBaseUrl).origin;
  } catch {
    return "http://localhost:8080";
  }
}

function websocketOrigin(apiOrigin) {
  const url = new URL(apiOrigin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.origin;
}

export function createSecurityHeaders({
  apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.VELO_API_BASE_URL ?? "http://localhost:8080",
  environment = process.env.NODE_ENV
} = {}) {
  const apiOrigin = configuredApiOrigin(apiBaseUrl);
  const wsOrigin = websocketOrigin(apiOrigin);

  // Next's App Router emits inline bootstrap/data scripts; without per-request nonce plumbing,
  // unsafe-inline is the narrow compatibility allowance. unsafe-eval is development-only.
  const scriptSources = ["'self'", "'unsafe-inline'"];
  if (environment !== "production") {
    scriptSources.push("'unsafe-eval'");
  }

  const contentSecurityPolicy = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    `script-src ${scriptSources.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' ${apiOrigin} ${wsOrigin} https://router.project-osrm.org`,
    "frame-src 'self' https://www.openstreetmap.org",
    "worker-src 'self' blob:"
  ].join("; ");

  const headers = [
    { key: "Content-Security-Policy", value: contentSecurityPolicy },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }
  ];

  if (environment === "production") {
    headers.push({ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" });
  }

  return headers;
}
