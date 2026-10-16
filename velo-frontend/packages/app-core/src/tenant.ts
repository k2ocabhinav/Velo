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
  timeZone: string;
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
  timeZone: "UTC",
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
  return getTenantPluralLabel(tripLabel, DEFAULT_TENANT_BRANDING.tripLabel);
}

export interface TripLabelOptions {
  /**
   * Lower-cases the label for mid-sentence use. Tenant labels are title-case
   * nouns, so "1 completed Trip" reads wrong; mid-sentence we want
   * "1 completed trip" / "3 completed transfers".
   */
  midSentence?: boolean;
  fallback?: string;
}

/** Adds a simple English plural suffix to a tenant noun while preserving its casing. */
export function getTenantPluralLabel(label: string | null | undefined, fallback = ""): string {
  const normalized = label?.trim() || fallback.trim();
  if (!normalized) return "";
  return /s$/i.test(normalized) ? normalized : `${normalized}s`;
}

/** Uses the existing account-page wording for Velo and the tenant noun for white-label rider accounts. */
export function getTenantAdminUsersLabel(riderLabel: string | null | undefined): string {
  const normalized = riderLabel?.trim();
  if (!normalized || normalized.toLowerCase() === DEFAULT_TENANT_BRANDING.riderLabel.toLowerCase()) return "Users";
  return getTenantPluralLabel(normalized);
}

/** Selects a tenant noun's singular or plural form and optionally lowers it for sentence copy. */
export function getTenantLabelForCount(
  count: number,
  label: string | null | undefined,
  { midSentence = false, fallback = "" }: TripLabelOptions = {},
): string {
  const singular = label?.trim() || fallback.trim();
  const selected = count === 1 ? singular : getTenantPluralLabel(singular);
  return midSentence ? selected.toLowerCase() : selected;
}

/** The tenant's trip label, pluralised to match the count ("1 Trip", "4 Trips"). */
export function getTenantTripLabelForCount(
  count: number,
  tripLabel: string | null | undefined,
  { midSentence = false, fallback = DEFAULT_TENANT_BRANDING.tripLabel }: TripLabelOptions = {},
): string {
  return getTenantLabelForCount(count, tripLabel, {
    midSentence,
    fallback,
  });
}

/** Title-case and sentence-case forms of the tenant nouns, ready to drop into rider and driver copy. */
export interface TenantLabelWords {
  rider: string;
  driver: string;
  trip: string;
  riders: string;
  drivers: string;
  trips: string;
  riderWord: string;
  driverWord: string;
  tripWord: string;
  tripsWord: string;
}

/**
 * Resolves every form of the rider, driver and trip nouns once so screens can build
 * "Accept transfer", "Your chauffeur" and "Your transfers" without repeating the casing rules.
 */
export function getTenantLabelWords(
  branding: Pick<TenantBranding, "riderLabel" | "driverLabel" | "tripLabel">,
): TenantLabelWords {
  const rider = branding.riderLabel?.trim() || DEFAULT_TENANT_BRANDING.riderLabel;
  const driver = branding.driverLabel?.trim() || DEFAULT_TENANT_BRANDING.driverLabel;
  const trip = branding.tripLabel?.trim() || DEFAULT_TENANT_BRANDING.tripLabel;
  const trips = getTenantPluralLabel(trip);
  return {
    rider,
    driver,
    trip,
    riders: getTenantPluralLabel(rider),
    drivers: getTenantPluralLabel(driver),
    trips,
    riderWord: rider.toLowerCase(),
    driverWord: driver.toLowerCase(),
    tripWord: trip.toLowerCase(),
    tripsWord: trips.toLowerCase(),
  };
}

/** Reads the tenant slug middleware attached to a request, falling back to the configured default. */
export function resolveTenantSlugFromHeader(
  headerValue: string | null | undefined,
  defaultTenantSlug = getDefaultTenantSlug(),
): string {
  const value = headerValue?.trim();
  return value ? value : defaultTenantSlug;
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
    timeZone: text("timeZone", DEFAULT_TENANT_BRANDING.timeZone, 64),
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

/**
 * Resolves the tenant slug from a request's host, the same way the middleware does. BFF routes are
 * excluded from the middleware matcher, so they resolve the host themselves rather than trusting
 * anything the browser sent in the body.
 */
export function resolveTenantSlugFromRequest(
  headers: { get(name: string): string | null },
  defaultTenantSlug = getDefaultTenantSlug(),
  tenantBaseDomain = getEnvValue("VELO_TENANT_BASE_DOMAIN") ?? "velo.app",
): string {
  const trustProxy = getEnvValue("VELO_TRUST_PROXY") === "1";
  const forwardedHost = trustProxy
    ? headers.get("x-forwarded-host")?.split(",", 1)[0]?.trim()
    : undefined;
  const host = forwardedHost || headers.get("host") || "";
  return resolveTenantSlug({ hostname: host, defaultTenantSlug, tenantBaseDomain });
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
