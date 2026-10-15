import { headers } from "next/headers";
import {
  DEFAULT_TENANT_BRANDING,
  fetchTenantBranding,
  resolveTenantSlugFromHeader,
  TENANT_SLUG_HEADER,
  type TenantBranding,
} from "./tenant";

export interface RequestTenantContext {
  tenantSlug: string;
  branding: TenantBranding;
}

/** Resolves the current request's tenant slug and branding for server components. */
export async function getRequestTenantContext(): Promise<RequestTenantContext> {
  const tenantSlug = resolveTenantSlugFromHeader((await headers()).get(TENANT_SLUG_HEADER));
  const branding = (await fetchTenantBranding(tenantSlug)) ?? DEFAULT_TENANT_BRANDING;
  return { tenantSlug, branding };
}
