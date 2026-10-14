"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";
import { landingCopy } from "../../content/site";
import styles from "./sections.module.css";

type BrandId = "velo" | "saffron";

export function BrandSwitcher() {
  const [brand, setBrand] = useState<BrandId>("velo");
  const copy = landingCopy.brands;
  const selected = copy.tenants.find((tenant) => tenant.id === brand) ?? copy.tenants[0];
  const previewStyle = {
    "--mock-accent": brand === "velo" ? "var(--landing-signal, var(--velo-blue))" : "var(--landing-teal, hsl(var(--color-accent)))",
  } as CSSProperties;

  return (
    <section className={`${styles.section} ${styles.brandSection}`} aria-labelledby="brand-title">
      <div className={styles.container}>
        <div className={styles.sectionIntro}>
          <h2 className={styles.sectionTitle} id="brand-title">{copy.title}</h2>
          <p className={styles.sectionDescription}>{copy.description}</p>
        </div>
        <div className={styles.brandDemo}>
          <fieldset className={styles.brandChoices}>
            <legend>{copy.chooseFleet}</legend>
            {copy.tenants.map((tenant) => (
              <label className={styles.brandChoice} key={tenant.id}>
                <input type="radio" name="demo-brand" value={tenant.id} checked={brand === tenant.id} onChange={() => setBrand(tenant.id as BrandId)} />
                <span>{tenant.name}</span>
              </label>
            ))}
          </fieldset>
          <div className={styles.bookingMock} data-brand={brand} style={previewStyle}>
            <div className={styles.bookingMockHeader}><span className={styles.brandWordmark}>{selected.name}</span><span>{copy.previewLabel}</span></div>
            <h3>{copy.previewTitle}</h3>
            <div className={styles.bookingFields}>
              <span><i aria-hidden="true" />{copy.pickup}</span>
              <span><i aria-hidden="true" />{copy.destination}</span>
              <span className={styles.mockButton}>{copy.continue}</span>
            </div>
          </div>
        </div>
        <div className={styles.brandScreens}>
          <figure className={styles.brandFigure}>
            <Image src="/screens/velo-business-dispatch.webp" alt="Velo Business dispatch console demonstration" width={1440} height={900} loading="lazy" sizes="(max-width: 768px) 100vw, 50vw" />
            <figcaption><strong>Velo Business</strong><span>{copy.sampleCaption}</span></figcaption>
          </figure>
          <figure className={styles.brandFigure}>
            <Image src="/screens/saffron-routes-dispatch.webp" alt="Saffron Routes dispatch console demonstration" width={1440} height={900} loading="lazy" sizes="(max-width: 768px) 100vw, 50vw" />
            <figcaption><strong>Saffron Routes</strong><span>{copy.sampleCaption}</span></figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
