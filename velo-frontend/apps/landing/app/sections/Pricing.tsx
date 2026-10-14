"use client";

import { useEffect, useState } from "react";
import { landingCopy } from "../../content/site";
import styles from "./sections.module.css";

type Currency = (typeof landingCopy.pricing.currencies)[number];
const rates: Record<Currency, { unit: number; minimum: number }> = {
  USD: { unit: 5, minimum: 49 },
  EUR: { unit: 5, minimum: 49 },
  INR: { unit: 299, minimum: 2990 },
};
const euroRegions = new Set(["AT", "BE", "CY", "DE", "EE", "ES", "FI", "FR", "GR", "HR", "IE", "IT", "LT", "LU", "LV", "MC", "MT", "NL", "PT", "SI", "SK"]);

function currencyForLocale(locale: string): Currency {
  const region = locale.split("-").pop()?.toUpperCase();
  if (region === "IN") return "INR";
  if (region && euroRegions.has(region)) return "EUR";
  return "USD";
}

function money(amount: number, currency: Currency) {
  const locale = currency === "INR" ? "en-IN" : currency === "EUR" ? "en-IE" : "en-US";
  return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

export function Pricing() {
  const [currency, setCurrency] = useState<Currency>("USD");
  const copy = landingCopy.pricing;
  const prices = rates[currency];
  const exampleTotal = prices.unit * 15;

  useEffect(() => {
    let storedCurrency: Currency | undefined;
    try {
      const stored = window.localStorage.getItem("velo-landing-currency");
      if (stored && copy.currencies.includes(stored as Currency)) storedCurrency = stored as Currency;
    } catch {
      // Locale selection remains available if browser storage is blocked.
    }
    setCurrency(storedCurrency ?? currencyForLocale(window.navigator.language));
  }, [copy.currencies]);

  function chooseCurrency(next: Currency) {
    setCurrency(next);
    try {
      window.localStorage.setItem("velo-landing-currency", next);
    } catch {
      // Keep the user's selection for this page when storage is unavailable.
    }
  }

  return (
    <section className={`${styles.section} ${styles.pricingSection}`} id="pricing" aria-labelledby="pricing-title">
      <div className={styles.container}>
        <div className={styles.pricingHeader}>
          <div className={styles.sectionIntro}>
            <h2 className={styles.sectionTitle} id="pricing-title">{copy.title}</h2>
            <p className={styles.sectionDescription}>{copy.description}</p>
          </div>
          <fieldset className={styles.currencySwitch}>
            <legend>Display currency</legend>
            {copy.currencies.map((item) => (
              <label className={styles.currencyOption} key={item}>
                <input type="radio" name="pricing-currency" value={item} checked={currency === item} onChange={() => chooseCurrency(item)} />
                <span>{item}</span>
              </label>
            ))}
          </fieldset>
        </div>
        <div className={styles.priceLayout}>
          <div className={styles.priceMain}>
            <div aria-live="polite" aria-atomic="true">
              <p className={styles.priceValue}>{money(prices.unit, currency)}</p>
              <p className={styles.priceUnit}>{copy.perVehicle}</p>
              <p className={styles.priceMinimum}>{money(prices.minimum, currency)} {copy.minimum}</p>
              <p className={styles.priceExampleLabel}>{copy.exampleLabel}</p>
              <p className={styles.priceExample}>{copy.examplePrefix} {money(prices.unit, currency)} = {money(exampleTotal, currency)} per month</p>
            </div>
            <p className={styles.priceCaveat}>{copy.taxes} {copy.caveat}</p>
            <a className={styles.primaryButton} href="#contact">{landingCopy.hero.bookDemo}</a>
          </div>
          <div className={styles.priceDetails}>
            <div><h3>{copy.includedTitle}</h3><ul>{copy.included.map((item) => <li key={item}>{item}</li>)}</ul></div>
            <div><h3>{copy.notIncludedTitle}</h3><ul>{copy.notIncluded.map((item) => <li key={item}>{item}</li>)}</ul></div>
          </div>
        </div>
      </div>
    </section>
  );
}
