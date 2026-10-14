"use client";

import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, PasswordField } from "@velo/ui/composed";

export function RegisterForm({ nextPath }: Readonly<{ nextPath: string }>) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
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
          referredByCode: referredByCode || undefined,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "Couldn't create your account. Check your details and try again.");
        return;
      }

      setMessage("Account created. Redirecting to sign in...");
      const target = `/login?next=${encodeURIComponent(nextPath)}`;
      window.setTimeout(() => {
        router.replace(target);
        router.refresh();
      }, 300);
    } catch {
      setError("Couldn't reach the server. Try again in a moment.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="stack" onSubmit={handleSubmit}>
      <Field label="Full name">
        <input name="name" type="text" autoComplete="name" required className="ui-control" />
      </Field>
      <Field label="Email">
        <input name="email" type="email" autoComplete="email" required className="ui-control" />
      </Field>
      <PasswordField label="Password" name="password" autoComplete="new-password" required minLength={8} />
      <Field label="Referral code (optional)">
        <input name="referredByCode" type="text" className="ui-control" />
      </Field>
      {error ? <p className="error-text" role="alert">{error}</p> : null}
      {message ? <p className="helper" role="status">{message}</p> : null}
      <button className="primary-button" type="submit" disabled={pending}>
        {pending ? "Creating account..." : "Create account"}
      </button>
    </form>
  );
}
