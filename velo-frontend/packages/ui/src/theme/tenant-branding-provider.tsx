"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_TENANT_BRANDING, type TenantBranding } from "@velo/app-core/tenant";

const TenantBrandingContext = createContext<TenantBranding | null>(null);

export function TenantBrandingProvider({
  branding,
  children,
}: Readonly<{ branding: TenantBranding; children: ReactNode }>) {
  return <TenantBrandingContext.Provider value={branding}>{children}</TenantBrandingContext.Provider>;
}

export function useTenantBranding(): TenantBranding {
  const branding = useContext(TenantBrandingContext);
  if (!branding) throw new Error("useTenantBranding must be used within TenantBrandingProvider");
  return branding;
}

export function useTenantBrandingOrDefault(): TenantBranding {
  return useContext(TenantBrandingContext) ?? DEFAULT_TENANT_BRANDING;
}
