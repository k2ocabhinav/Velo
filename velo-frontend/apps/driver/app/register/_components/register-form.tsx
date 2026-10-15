"use client";

import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, PasswordField } from "@velo/ui/composed";

export function RegisterForm({ initialError = null }: Readonly<{ initialError?: string | null }>) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(initialError);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setPending(true);

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "");
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const vehicleId = String(formData.get("vehicleId") ?? "").trim();
    const referredByCode = String(formData.get("referredByCode") ?? "").trim();

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
          vehicleId,
          referredByCode: referredByCode || undefined,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "Couldn't create your account. Check your details and try again.");
        return;
      }

      setMessage("Application submitted. Redirecting to sign in…");
      window.setTimeout(() => {
        router.replace("/login");
        router.refresh();
      }, 300);
    } catch {
      setError("Couldn't reach the server. Try again in a moment.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="stack" method="post" action="/api/auth/register" onSubmit={handleSubmit}>
      <Field label="Full name">
        <input name="name" type="text" autoComplete="name" required className="ui-control" />
      </Field>
      <Field label="Email">
        <input name="email" type="email" autoComplete="email" required className="ui-control" />
      </Field>
      <PasswordField label="Password" name="password" autoComplete="new-password" required minLength={8} />
      <Field label="Vehicle ID">
        <input name="vehicleId" type="text" autoComplete="off" inputMode="text" required className="ui-control" />
      </Field>
      <Field label="Referral code (optional)">
        <input name="referredByCode" type="text" autoComplete="off" inputMode="text" className="ui-control" />
      </Field>
      {error ? <p className="error-text" role="alert">{error}</p> : null}
      {message ? <p className="helper" role="status">{message}</p> : null}
      <button className="primary-button" type="submit" disabled={pending}>
        {pending ? "Submitting…" : "Submit application"}
      </button>
    </form>
  );
}
