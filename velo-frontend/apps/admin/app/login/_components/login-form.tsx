"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { Field, PasswordField } from "@velo/ui/composed";

export function LoginForm({
  nextPath,
  initialError = null,
}: Readonly<{ nextPath: string; initialError?: string | null }>) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(initialError);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.error ?? "Couldn't sign in. Check your email and password.");
        return;
      }

      router.replace(nextPath);
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Try again in a moment.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="stack" method="post" action="/api/auth/login" onSubmit={handleSubmit}>
      <input type="hidden" name="next" value={nextPath} />
      <Field label="Email">
        <input name="email" type="email" autoComplete="email" required className="ui-control" />
      </Field>
      <PasswordField name="password" autoComplete="current-password" required />
      {error ? <p className="error-text" role="alert">{error}</p> : null}
      <button className="primary-button" type="submit" disabled={pending}>
        {pending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
