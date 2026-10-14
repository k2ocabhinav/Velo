import { act, createElement as h, type ReactElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { DEFAULT_TENANT_BRANDING } from "@velo/app-core/tenant";
import { AuthLayout, PasswordField } from "../src/composed";
import { TenantBrandingProvider } from "../src/theme/tenant-branding-provider";

function html(node: ReactNode): string {
  return renderToStaticMarkup(node as ReactElement);
}

describe("shared auth components", () => {
  it("renders the auth frame with a dark brand panel and its form", () => {
    const markup = html(h(TenantBrandingProvider, {
      branding: DEFAULT_TENANT_BRANDING,
      children: h(AuthLayout, {
        product: "Admin",
        statement: "Run dispatch, approvals and payouts for your fleet.",
        title: "Sign in to Velo Admin",
        children: "Login form",
      }),
    }));

    expect(markup).toContain('class="auth-brand velo-theme-dark"');
    expect(markup).toContain('class="auth-tenant-wordmark" title="VELO">VELO</span>');
    expect(markup).toContain('class="auth-product">Admin</span>');
    expect(markup).toContain("Run dispatch, approvals and payouts for your fleet.");
    expect(markup).toContain("Sign in to Velo Admin");
    expect(markup).toContain("Login form");
  });

  it("renders the tenant wordmark in the auth frame", () => {
    const markup = html(h(TenantBrandingProvider, {
      branding: { ...DEFAULT_TENANT_BRANDING, brandName: "Northstar Mobility" },
      children: h(AuthLayout, {
        product: "Rider",
        statement: "Book a ride.",
        title: "Sign in",
        children: "Login form",
      }),
    }));

    expect(markup).toContain('class="auth-tenant-wordmark" title="Northstar Mobility">Northstar Mobility</span>');
  });

  it("associates the password label with its input and toggles visibility accessibly", async () => {
    const dom = new JSDOM("<!doctype html><html><body><div id=\"root\"></div></body></html>");
    const globalKeys = ["window", "document", "navigator", "IS_REACT_ACT_ENVIRONMENT"] as const;
    const originalDescriptors = new Map(globalKeys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    Object.defineProperty(globalThis, "window", { configurable: true, value: dom.window });
    Object.defineProperty(globalThis, "document", { configurable: true, value: dom.window.document });
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: dom.window.navigator });
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });

    const container = dom.window.document.getElementById("root");
    if (!container) throw new Error("Test root element was not created.");
    const root = createRoot(container);

    try {
      await act(async () => {
        root.render(h(PasswordField, { label: "Account password", name: "password" }));
      });

      const input = container.querySelector("input");
      const label = container.querySelector("label");
      const toggle = container.querySelector("button");
      expect(input?.type).toBe("password");
      expect(label?.htmlFor).toBe(input?.id);
      expect(label?.textContent).toBe("Account password");
      expect(toggle?.getAttribute("aria-controls")).toBe(input?.id);
      expect(toggle?.getAttribute("aria-pressed")).toBe("false");

      await act(async () => {
        toggle?.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
      });

      expect(input?.type).toBe("text");
      expect(toggle?.getAttribute("aria-pressed")).toBe("true");
      expect(toggle?.textContent).toBe("Hide");
    } finally {
      await act(async () => root.unmount());
      dom.window.close();
      for (const key of globalKeys) {
        const descriptor = originalDescriptors.get(key);
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    }
  });
});
