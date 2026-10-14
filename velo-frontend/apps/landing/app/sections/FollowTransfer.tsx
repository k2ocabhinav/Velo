"use client";

import Image from "next/image";
import { useState } from "react";
import { landingCopy } from "../../content/site";
import styles from "./sections.module.css";

export function FollowTransfer() {
  const [activeStep, setActiveStep] = useState(0);
  const copy = landingCopy.follow;
  const active = copy.steps[activeStep] ?? copy.steps[0];

  return (
    <section className={`${styles.section} ${styles.followSection}`} id="how-it-works" aria-labelledby="follow-title">
      <div className={styles.container}>
        <div className={styles.sectionIntro}>
          <h2 className={styles.sectionTitle} id="follow-title">{copy.title}</h2>
          <p className={styles.sectionDescription}>{copy.description}</p>
        </div>
        <div className={styles.followLayout}>
          <div className={styles.stepList} role="tablist" aria-label="Transfer steps" aria-orientation="vertical">
            {copy.steps.map((step, index) => (
              <button
                className={`${styles.stepButton} ${activeStep === index ? styles.activeStepButton : ""}`}
                id={`transfer-tab-${index}`}
                key={step.title}
                type="button"
                role="tab"
                aria-selected={activeStep === index}
                aria-controls="transfer-panel"
                tabIndex={activeStep === index ? 0 : -1}
                onClick={() => setActiveStep(index)}
                onKeyDown={(event) => {
                  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
                  event.preventDefault();
                  const next = event.key === "Home" ? 0 : event.key === "End" ? copy.steps.length - 1 : (activeStep + (event.key === "ArrowDown" ? 1 : -1) + copy.steps.length) % copy.steps.length;
                  setActiveStep(next);
                  document.getElementById(`transfer-tab-${next}`)?.focus();
                }}
              >
                <span className={styles.stepMarker} aria-hidden="true" />
                <span className={styles.stepText}><strong>{step.title}</strong><span>{step.detail}</span></span>
              </button>
            ))}
          </div>
          <div className={styles.productPanel} id="transfer-panel" role="tabpanel" aria-labelledby={`transfer-tab-${activeStep}`} tabIndex={0}>
            <figure className={styles.productFigure}>
              <Image
                key={active.image}
                src={`/screens/${active.image}`}
                alt={active.alt}
                width={active.image === "rider-booking.webp" || active.image === "driver-home.webp" ? 390 : 1440}
                height={active.image === "rider-booking.webp" || active.image === "driver-home.webp" ? 844 : 900}
                loading="lazy"
                sizes="(max-width: 768px) 100vw, 58vw"
                className={active.image === "rider-booking.webp" || active.image === "driver-home.webp" ? styles.productPhoneImage : styles.productWideImage}
              />
              <figcaption><strong>{active.caption}</strong><span>{landingCopy.brands.sampleCaption}</span></figcaption>
            </figure>
          </div>
          <div className={styles.mobileStepScreens}>
            {copy.steps.map((step) => (
              <article className={styles.mobileProductStep} key={step.title}>
                <h3>{step.title}</h3>
                <p>{step.detail}</p>
                <figure className={styles.productFigure}>
                  <Image
                    src={`/screens/${step.image}`}
                    alt={step.alt}
                    width={step.image === "rider-booking.webp" || step.image === "driver-home.webp" ? 390 : 1440}
                    height={step.image === "rider-booking.webp" || step.image === "driver-home.webp" ? 844 : 900}
                    loading="lazy"
                    sizes="(max-width: 768px) 100vw, 58vw"
                    className={step.image === "rider-booking.webp" || step.image === "driver-home.webp" ? styles.productPhoneImage : styles.productWideImage}
                  />
                  <figcaption><strong>{step.caption}</strong><span>{landingCopy.brands.sampleCaption}</span></figcaption>
                </figure>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
