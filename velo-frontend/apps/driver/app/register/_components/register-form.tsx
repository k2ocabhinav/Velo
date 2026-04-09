"use client";

import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function RegisterForm() {
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
        setError(payload?.error ?? "Unable to create account.");
        return;
      }

      setMessage("Account created. Redirecting to sign in...");
      window.setTimeout(() => {
        router.replace("/login");
        router.refresh();
      }, 300);
    } catch {
      setError("Unable to create account right now.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="stack" onSubmit={handleSubmit}>
      <label className="field">
        <span>Full name</span>
        <input name="name" type="text" autoComplete="name" required />
      </label>
      <label className="field">
        <span>Email</span>
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label className="field">
        <span>Password</span>
        <input name="password" type="password" autoComplete="new-password" required minLength={8} />
      </label>
      <label className="field">
        <span>Vehicle ID</span>
        <input name="vehicleId" type="text" required />
      </label>
      <label className="field">
        <span>Referral code (optional)</span>
        <input name="referredByCode" type="text" />
      </label>
      {error ? <p className="error-text">{error}</p> : null}
      {message ? <p className="helper">{message}</p> : null}
      <button className="primary-button" type="submit" disabled={pending}>
        {pending ? "Creating account..." : "Create account"}
      </button>
      <p className="helper">
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </form>
  );
}
