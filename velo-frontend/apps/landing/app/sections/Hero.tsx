"use client";

import { useState } from "react";
import { landingCopy, siteConfig } from "../../content/site";
import { SAMPLE_TRIPS } from "../../content/sample-trips";
import { DispatchIllustration } from "./_placeholder-dispatch";
import styles from "./sections.module.css";

export function Hero() {
  const [selectedTripId, setSelectedTripId] = useState(SAMPLE_TRIPS[0]?.id ?? "");
  const demoLink = siteConfig.demoVideoUrl
    ? { href: siteConfig.demoVideoUrl, label: landingCopy.hero.watchDemo }
    : { href: "#how-it-works", label: landingCopy.hero.seeHow };

  return (
    <section className={styles.hero} id="top" aria-labelledby="hero-title">
      <div className={styles.container}>
        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <p className={styles.stageLine}>{landingCopy.hero.stage}</p>
            <h1 className={styles.heroTitle} id="hero-title">{landingCopy.hero.title}</h1>
            <p className={styles.heroDescription}>{landingCopy.hero.description}</p>
            <div className={styles.heroActions}>
              <a className={styles.primaryButton} href="#contact">{landingCopy.hero.bookDemo}</a>
              <a className={styles.secondaryButton} href={demoLink.href} target={siteConfig.demoVideoUrl ? "_blank" : undefined} rel={siteConfig.demoVideoUrl ? "noreferrer" : undefined}>{demoLink.label}</a>
            </div>
          </div>
          <div className={styles.heroVisual}>
            <DispatchIllustration trips={SAMPLE_TRIPS} selectedTripId={selectedTripId} onSelectTrip={setSelectedTripId} />
          </div>
        </div>
      </div>
    </section>
  );
}
