"use client";

import { useState, type FormEvent } from "react";

const contactAction = process.env.NEXT_PUBLIC_CONTACT_FORM_ACTION?.trim() ?? "";
const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "hello@velo.dev";

export function ContactForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);

    if (!contactAction) {
      const subject = `Velo demo request — ${String(fields.get("company"))}`;
      const body = [
        `Name: ${fields.get("name")}`,
        `Company: ${fields.get("company")}`,
        `Fleet size: ${fields.get("fleetSize")}`,
        `City: ${fields.get("city")}`,
        `Email: ${fields.get("email")}`,
        `Phone: ${fields.get("phone") || "Not provided"}`,
        "",
        `Message: ${fields.get("message")}`,
      ].join("\n");
      window.location.href = `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      setStatus({ type: "success", message: `Your email app should open with the request addressed to ${contactEmail}. Send it there to complete your request.` });
      return;
    }

    setIsSubmitting(true);
    setStatus(null);
    try {
      const response = await fetch(contactAction, {
        method: "POST",
        body: fields,
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("The form service returned an error.");
      form.reset();
      setStatus({ type: "success", message: "Thanks. Your demo request has been sent." });
    } catch {
      setStatus({ type: "error", message: `We couldn’t send your request. Try again or email ${contactEmail}.` });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="contact-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <div className="form-field">
          <label htmlFor="contact-name">Name</label>
          <input autoComplete="name" id="contact-name" name="name" required />
        </div>
        <div className="form-field">
          <label htmlFor="contact-company">Company</label>
          <input autoComplete="organization" id="contact-company" name="company" required />
        </div>
        <div className="form-field">
          <label htmlFor="contact-fleet-size">Fleet size</label>
          <select defaultValue="" id="contact-fleet-size" name="fleetSize" required>
            <option value="" disabled>Select vehicles</option>
            <option value="1–9">1–9 vehicles</option>
            <option value="10–25">10–25 vehicles</option>
            <option value="26–50">26–50 vehicles</option>
            <option value="51+">51+ vehicles</option>
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="contact-city">City</label>
          <input autoComplete="address-level2" id="contact-city" name="city" required />
        </div>
        <div className="form-field">
          <label htmlFor="contact-email">Email</label>
          <input autoComplete="email" id="contact-email" name="email" type="email" required />
        </div>
        <div className="form-field">
          <label htmlFor="contact-phone">Phone <span>(optional)</span></label>
          <input autoComplete="tel" id="contact-phone" name="phone" type="tel" pattern="[+0-9() .-]{7,20}" title="Enter a phone number with at least 7 digits." />
        </div>
        <div className="form-field form-field-wide">
          <label htmlFor="contact-message">Message</label>
          <textarea id="contact-message" name="message" rows={4} required />
        </div>
      </div>
      <div className="form-submit-row">
        <button className="button button-primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Sending request…" : "Book a demo"} {!isSubmitting && <span aria-hidden="true">→</span>}
        </button>
        <p className="form-privacy">We’ll use these details only to respond to your enquiry.</p>
      </div>
      {status && <p className={`form-status form-status-${status.type}`} role={status.type === "error" ? "alert" : "status"}>{status.message}</p>}
    </form>
  );
}
