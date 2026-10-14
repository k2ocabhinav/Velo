"use client";

import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { RouteStrip } from "./route-strip";
import { getTenantWordmark } from "@velo/app-core/tenant";
import { useTenantBranding } from "../theme/tenant-branding-provider";

/**
 * Two-panel sign-in / sign-up frame shared by the rider, driver and admin apps.
 * The brand panel collapses to a compact header below 60rem.
 */
export function AuthLayout({
  children,
  description,
  footer,
  product,
  statement,
  title,
}: {
  /** Portal name shown next to the wordmark, e.g. "Rider". */
  product: string;
  /** One plain sentence about what this portal is for. */
  statement: string;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { brandName } = useTenantBranding();
  const wordmark = getTenantWordmark(brandName);

  return (
    <main className="auth-shell">
      <aside className="auth-brand velo-theme-dark" aria-label={`${wordmark} ${product}`}>
        <p className="auth-wordmark" aria-label={`${wordmark} ${product}`}>
          <span className="auth-tenant-wordmark" title={wordmark}>{wordmark}</span>
          <span className="auth-product">{product}</span>
        </p>
        <p className="auth-statement">{statement}</p>
        <RouteStrip className="auth-route" stage="on_trip" variant="static" />
      </aside>
      <section className="auth-panel">
        <div className="auth-form">
          <header className="stack compact">
            <h1 className="auth-title">{title}</h1>
            {description ? <p className="helper">{description}</p> : null}
          </header>
          {children}
          {footer ? <div className="auth-footer">{footer}</div> : null}
        </div>
      </section>
    </main>
  );
}

/** Password input with an accessible show/hide toggle. */
export function PasswordField({
  className,
  id,
  label = "Password",
  ...inputProps
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label?: string }) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);

  return (
    <div className={cn("ui-field", className)}>
      <label className="ui-field-label" htmlFor={inputId}>{label}</label>
      <div className="password-control">
        <input {...inputProps} id={inputId} type={visible ? "text" : "password"} className="ui-control" />
        <button
          type="button"
          className="password-toggle"
          aria-controls={inputId}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}
