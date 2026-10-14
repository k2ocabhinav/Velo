"use client";

import { useState, type FormEvent } from "react";
import { landingCopy, siteConfig, whatsappHref } from "../../content/site";
import styles from "./sections.module.css";

type FormStatus = { type: "success" | "error"; message: string } | null;

export function DemoContact() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<FormStatus>(null);
  const copy = landingCopy.contact;
  const whatsapp = siteConfig.whatsappNumber ? whatsappHref(siteConfig.whatsappNumber) : undefined;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setStatus(null);
    if (!siteConfig.contactFormAction) {
      const contactEmail = siteConfig.contactEmail;
      if (!contactEmail) return;
      const body = [
        `Name: ${fields.get("name")}`,
        `Phone or WhatsApp: ${fields.get("phone")}`,
        `Fleet size: ${fields.get("fleetSize")}`,
        fields.get("city") ? `City: ${fields.get("city")}` : undefined,
        fields.get("preferredTime") ? `Preferred time: ${fields.get("preferredTime")}` : undefined,
        `Email: ${fields.get("email") || "Not provided"}`,
      ].filter(Boolean).join("\n");
      window.location.href = `mailto:${contactEmail}?subject=${encodeURIComponent("Velo demo request")}&body=${encodeURIComponent(body)}`;
      setStatus({ type: "success", message: copy.mailto.replace("{email}", contactEmail) });
      return;
    }

    setIsSubmitting(true);
    const encodedFields = new URLSearchParams();
    fields.forEach((value, key) => { if (typeof value === "string") encodedFields.append(key, value); });
    encodedFields.set("form-name", "demo-request");
    try {
      const response = await fetch(siteConfig.contactFormAction, { method: "POST", body: encodedFields, headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Contact form submission failed.");
      form.reset();
      setStatus({ type: "success", message: copy.sent });
    } catch {
      setStatus({ type: "error", message: copy.failed });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className={`${styles.section} ${styles.tintNight} ${styles.contactSection}`} id="book-a-demo" aria-labelledby="contact-title">
      <div className={styles.container}>
        <div className={styles.contactLayout}>
          <div className={styles.contactIntro}>
            <p className={styles.eyebrow}>{copy.eyebrow}</p>
            <h2 className={styles.sectionTitle} id="contact-title">
              {siteConfig.demoContactAvailable ? copy.title : copy.unavailableTitle}
            </h2>
            <p className={styles.sectionDescription}>
              {siteConfig.demoContactAvailable ? copy.description : copy.unavailableDescription}
            </p>
            {siteConfig.demoContactAvailable && <p className={styles.contactNextStep}>{copy.nextStep}</p>}
            <div className={styles.contactLinks}>
              {whatsapp && <a className={styles.secondaryButton} href={whatsapp} target="_blank" rel="noreferrer">{copy.whatsapp}</a>}
              {siteConfig.contactEmail && <a className={styles.contactEmail} href={`mailto:${siteConfig.contactEmail}`}>{copy.emailLink}</a>}
            </div>
          </div>
          {siteConfig.contactFormAction || siteConfig.contactEmail ? (
            <form className={styles.contactForm} name="demo-request" data-netlify="true" onSubmit={handleSubmit}>
              <input type="hidden" name="form-name" value="demo-request" />
              <div className={styles.formGrid}>
                <div className={styles.formField}><label htmlFor="demo-name">{copy.name}</label><input autoComplete="name" id="demo-name" name="name" required /></div>
                <div className={styles.formField}><label htmlFor="demo-phone">{copy.phone}</label><input autoComplete="tel" id="demo-phone" name="phone" type="tel" required /></div>
                <div className={styles.formField}>
                  <label htmlFor="demo-fleet-size">{copy.fleetSize}</label>
                  <select id="demo-fleet-size" name="fleetSize" defaultValue="" required>
                    <option value="" disabled>Select a range</option><option value="10–25">10–25 vehicles</option><option value="26–50">26–50 vehicles</option><option value="Other">Other</option>
                  </select>
                </div>
                <div className={styles.formField}><label htmlFor="demo-city">{copy.city}</label><input autoComplete="address-level2" id="demo-city" name="city" /></div>
                <div className={styles.formField}><label htmlFor="demo-time">{copy.preferredTime}</label><input id="demo-time" name="preferredTime" placeholder={copy.timePlaceholder} /></div>
                <div className={styles.formField}><label htmlFor="demo-email">{copy.email}</label><input autoComplete="email" id="demo-email" name="email" type="email" /></div>
              </div>
              <div className={styles.formSubmit}>
                <button className={styles.primaryButton} type="submit" disabled={isSubmitting}>
                  {isSubmitting ? copy.sending : siteConfig.contactFormAction ? copy.submit : copy.prepareEmail}
                </button>
                <p>{siteConfig.contactFormAction ? copy.privacy : copy.mailtoPrivacy}</p>
              </div>
              {status && <p className={status.type === "error" ? styles.formError : styles.formSuccess} role={status.type === "error" ? "alert" : "status"}>{status.message}</p>}
            </form>
          ) : !whatsapp ? (
            <p className={styles.noContactNotice} role="status">{copy.noContact}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
