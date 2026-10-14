"use client";

import { useState, type FormEvent } from "react";

const contactAction = process.env.NEXT_PUBLIC_CONTACT_FORM_ACTION?.trim() ?? "";
const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "hello@velo.dev";
const whatsappDigits = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "") ?? "";
const contactPostPath = "/_velo/contact";

type FormStatus =
  | { type: "success"; message: string }
  | { type: "error"; message: string };

function mailtoFor(fields: FormData) {
  const body = [
    `Name: ${String(fields.get("name") ?? "")}`,
    `Phone or WhatsApp: ${String(fields.get("phone") ?? "")}`,
    `Fleet size: ${String(fields.get("fleetSize") ?? "")}`,
    `City: ${String(fields.get("city") ?? "")}`,
    `Preferred time: ${String(fields.get("preferredTime") ?? "")}`,
    `Email: ${String(fields.get("email") ?? "Not provided") || "Not provided"}`,
  ].join("\n");
  const subject = `Velo demo request — ${String(fields.get("city") ?? "")}`;
  return `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function ContactForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<FormStatus | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setStatus(null);

    if (!contactAction) {
      window.location.href = mailtoFor(fields);
      setStatus({
        type: "success",
        message: `Your email app should open with the request addressed to ${contactEmail}. Send it there to complete your request.`,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(contactPostPath, {
        method: "POST",
        body: fields,
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("The form service returned an error.");
      form.reset();
      setStatus({ type: "success", message: "Thanks. Your demo request has been sent." });
    } catch {
      setStatus({
        type: "error",
        message: `We couldn’t send your request. Try again or email ${contactEmail}.`,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const whatsappHref = whatsappDigits
    ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent("Hi, I’d like to book a Velo demo.")}`
    : undefined;

  return (
    <div>
      <form className="contact-form" onSubmit={handleSubmit} aria-describedby="form-help">
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="contact-name">Name</label>
            <input autoComplete="name" id="contact-name" name="name" required />
          </div>
          <div className="form-field">
            <label htmlFor="contact-phone">Phone or WhatsApp</label>
            <input autoComplete="tel" id="contact-phone" name="phone" type="tel" required />
          </div>
          <div className="form-field">
            <label htmlFor="contact-fleet-size">Fleet size</label>
            <select defaultValue="" id="contact-fleet-size" name="fleetSize" required>
              <option value="" disabled>Select vehicles</option>
              <option value="10–25">10–25 vehicles</option>
              <option value="26–50">26–50 vehicles</option>
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="contact-city">City</label>
            <input autoComplete="address-level2" id="contact-city" name="city" required />
          </div>
          <div className="form-field">
            <label htmlFor="contact-preferred-time">Preferred time</label>
            <input
              autoComplete="off"
              id="contact-preferred-time"
              name="preferredTime"
              placeholder="For example, 09:00–12:00 UTC"
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="contact-email">Email <span>(optional)</span></label>
            <input autoComplete="email" id="contact-email" name="email" type="email" />
          </div>
        </div>

        <div className="form-submit-row">
          <button className="button button-primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Sending request…" : "Book a demo"}
          </button>
          <p className="form-privacy" id="form-help">
            We’ll use these details to arrange a demo. Email is optional.
          </p>
        </div>

        {status && (
          <p className={`form-status form-status-${status.type}`} role={status.type === "error" ? "alert" : "status"}>
            {status.message}
          </p>
        )}
      </form>

      <div className="contact-alternatives" aria-label="Other ways to contact Velo">
        {whatsappHref && (
          <a href={whatsappHref} target="_blank" rel="noreferrer">
            WhatsApp the founder
          </a>
        )}
        <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
      </div>
    </div>
  );
}
