import type { CliOptions } from "./config.ts";
import { SIM_TENANTS } from "./config.ts";

export class SafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SafetyError";
  }
}

export function assertSimulationAllowed(value: string | undefined): void {
  if (value !== "1") {
    throw new SafetyError("Refusing to start: set VELO_SIM_ALLOW=1 to explicitly allow the demo simulator.");
  }
}

export function isLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".localhost");
}

export function validateApiBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new SafetyError("Refusing to start: --api must be an absolute http:// or https:// URL on loopback.");
  }
  if ((url.protocol !== "http:" && url.protocol !== "https:") || !isLoopbackHost(url.hostname)) {
    throw new SafetyError(`Refusing to start: API host must be loopback; received ${url.hostname || "(empty)"}.`);
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new SafetyError("Refusing to start: --api must not include credentials, a query, or a fragment.");
  }
  return value.replace(/\/+$/, "");
}

export function validateOptions(options: CliOptions, allowValue: string | undefined): CliOptions {
  assertSimulationAllowed(allowValue);
  const apiBaseUrl = validateApiBaseUrl(options.apiBaseUrl);
  for (const slug of options.tenants) {
    const tenant = SIM_TENANTS[slug];
    for (const account of [...tenant.drivers, ...tenant.riders]) {
      if (!account.email.endsWith(`@${tenant.simDomain}`)) {
        throw new SafetyError(`Refusing to start: ${account.key} is not on tenant ${slug}'s simulator email domain.`);
      }
    }
  }
  return { ...options, apiBaseUrl };
}
