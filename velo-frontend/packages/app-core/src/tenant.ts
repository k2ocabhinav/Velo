import { getApiBaseUrl, getEnvValue } from "./env";
import { NextResponse, type NextRequest } from "next/server";

export const TENANT_SLUG_HEADER = "x-velo-tenant-slug";
export const DEFAULT_TENANT_SLUG = "default";

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const RESERVED_SUBDOMAINS = new Set(["admin", "api", "app", "driver", "rider", "www"]);

export interface TenantBranding {
  tenantId: number | null;
  brandName: string;
  primaryColor: string;
  logoUrl: string | null;
  riderLabel: string;
  driverLabel: string;
  tripLabel: string;
  currency: string;
  dispatchMode: string;
  riderPortalEnabled: boolean;
}

export const DEFAULT_TENANT_BRANDING: TenantBranding = {
  tenantId: null,
  brandName: "Velo",
  primaryColor: "#2563EB",
  logoUrl: null,
  riderLabel: "Rider",
  driverLabel: "Driver",
  tripLabel: "Trip",
  currency: "USD",
  dispatchMode: "RIDE_HAILING",
  riderPortalEnabled: true,
};

export function getTenantWordmark(brandName: string | null | undefined): string {
  const normalized = brandName?.trim();
  if (!normalized || normalized.toLowerCase() === "velo") return "VELO";
  return normalized;
}

export function getTenantPluralTripLabel(tripLabel: string | null | undefined): string {
  const normalized = tripLabel?.trim();
  if (!normalized) return "Trips";
  return /s$/i.test(normalized) ? normalized : `${normalized}s`;
}

/** The tenant's trip label, pluralised to match the count ("1 Trip", "4 Trips"). */
export function getTenantTripLabelForCount(count: number, tripLabel: string | null | undefined): string {
  const singular = tripLabel?.trim() || DEFAULT_TENANT_BRANDING.tripLabel;
  return count === 1 ? singular : getTenantPluralTripLabel(singular);
}

export interface TenantSlugOptions {
  hostname: string;
  defaultTenantSlug?: string;
  tenantBaseDomain?: string;
}

function validSlug(value: string | undefined): value is string {
  return Boolean(value && SLUG_PATTERN.test(value));
}

/** Resolves tenant subdomains while keeping platform and local hosts on the configured default. */
export function resolveTenantSlug({
  hostname,
  defaultTenantSlug = DEFAULT_TENANT_SLUG,
  tenantBaseDomain = "velo.app",
}: TenantSlugOptions): string {
  const fallback = validSlug(defaultTenantSlug) ? defaultTenantSlug : DEFAULT_TENANT_SLUG;
  const host = hostname.trim().toLowerCase().replace(/\.$/, "").split(":")[0] ?? "";
  const baseDomain = tenantBaseDomain.trim().toLowerCase().replace(/^\.+|\.+$/g, "");

  if (host.endsWith(".localhost")) {
    const localSlug = host.slice(0, -".localhost".length);
    return validSlug(localSlug) ? localSlug : fallback;
  }

  const suffix = `.${baseDomain}`;
  if (baseDomain && host.endsWith(suffix)) {
    const subdomain = host.slice(0, -suffix.length);
    if (validSlug(subdomain) && !RESERVED_SUBDOMAINS.has(subdomain)) return subdomain;
  }

  return fallback;
}

function brandingFromPayload(payload: unknown): TenantBranding | null {
  if (!payload || typeof payload !== "object") return null;
  const outer = payload as Record<string, unknown>;
  const candidate = (outer.data && typeof outer.data === "object" ? outer.data : payload) as Record<string, unknown>;
  if (typeof candidate.brandName !== "string" || typeof candidate.primaryColor !== "string") return null;

  const text = (key: string, fallback: string, maxLength: number) => {
    const value = candidate[key];
    return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : fallback;
  };

  return {
    tenantId: typeof candidate.tenantId === "number" ? candidate.tenantId : null,
    brandName: text("brandName", DEFAULT_TENANT_BRANDING.brandName, 96),
    primaryColor: candidate.primaryColor,
    logoUrl: typeof candidate.logoUrl === "string" ? candidate.logoUrl : null,
    riderLabel: text("riderLabel", DEFAULT_TENANT_BRANDING.riderLabel, 64),
    driverLabel: text("driverLabel", DEFAULT_TENANT_BRANDING.driverLabel, 64),
    tripLabel: text("tripLabel", DEFAULT_TENANT_BRANDING.tripLabel, 64),
    currency: typeof candidate.currency === "string" && /^[A-Z]{3}$/.test(candidate.currency)
      ? candidate.currency
      : DEFAULT_TENANT_BRANDING.currency,
    dispatchMode: text("dispatchMode", DEFAULT_TENANT_BRANDING.dispatchMode, 32),
    riderPortalEnabled: typeof candidate.riderPortalEnabled === "boolean" ? candidate.riderPortalEnabled : true,
  };
}

export async function fetchTenantBranding(
  tenantSlug: string,
  fetcher: typeof fetch = fetch,
  apiBaseUrl = getApiBaseUrl(),
): Promise<TenantBranding | null> {
  const safeSlug = validSlug(tenantSlug) ? tenantSlug : DEFAULT_TENANT_SLUG;
  try {
    const response = await fetcher(
      `${apiBaseUrl.replace(/\/$/, "")}/api/v1/public/tenant/branding?tenant=${encodeURIComponent(safeSlug)}`,
      {
        headers: { Accept: "application/json" },
        cache: "force-cache",
        next: { revalidate: 60 },
      } as RequestInit,
    );
    if (!response.ok) return null;
    return brandingFromPayload(await response.json());
  } catch {
    return null;
  }
}

export function getDefaultTenantSlug(): string {
  const configured = getEnvValue("VELO_DEFAULT_TENANT_SLUG");
  return validSlug(configured) ? configured : DEFAULT_TENANT_SLUG;
}

export function attachTenantSlugHeader(
  request: NextRequest,
  response: NextResponse,
  defaultTenantSlug = getDefaultTenantSlug(),
  tenantBaseDomain = getEnvValue("VELO_TENANT_BASE_DOMAIN") ?? "velo.app",
): NextResponse {
  // Preserve auth redirects; the redirected page will resolve the same host again.
  if (response.headers.has("location")) return response;

  const requestHeaders = new Headers(request.headers);
  const trustProxy = getEnvValue("VELO_TRUST_PROXY") === "1";
  const forwardedHost = trustProxy
    ? request.headers.get("x-forwarded-host")?.split(",", 1)[0]?.trim()
    : undefined;
  const requestHost = forwardedHost || request.headers.get("host") || request.nextUrl.hostname;
  requestHeaders.set(
    TENANT_SLUG_HEADER,
    resolveTenantSlug({ hostname: requestHost, defaultTenantSlug, tenantBaseDomain }),
  );
  return NextResponse.next({ request: { headers: requestHeaders } });
}
