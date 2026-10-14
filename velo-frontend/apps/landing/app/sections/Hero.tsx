import { landingCopy, siteConfig } from "../../content/site";
import { DispatchIllustration } from "@velo/ui/landing";
import shared from "./sections.module.css";
import styles from "./Hero.module.css";

export function Hero() {
  const demoLink = siteConfig.demoVideoUrl
    ? { href: siteConfig.demoVideoUrl, label: landingCopy.hero.watchDemo }
    : { href: "#how-it-works", label: landingCopy.hero.seeHow };

  return (
    <section className={styles.hero} id="top" aria-labelledby="hero-title">
      <div className={shared.container}>
        <div className={styles.grid}>
          <div className={styles.copy}>
            <p className={styles.ticket}>
              <span className={styles.ticketText}>{landingCopy.hero.stage}</span>
              <span className={styles.ticketStamp} aria-hidden="true">Pre-launch</span>
            </p>
            <h1 className={styles.title} id="hero-title">{landingCopy.hero.title}</h1>
            <p className={styles.description}>{landingCopy.hero.description}</p>
            <div className={styles.actions}>
              <a className={styles.primary} href="#book-a-demo">{landingCopy.hero.bookDemo}</a>
              <a
                className={styles.voucher}
                href={demoLink.href}
                target={siteConfig.demoVideoUrl ? "_blank" : undefined}
                rel={siteConfig.demoVideoUrl ? "noreferrer" : undefined}
              >
                {demoLink.label}
              </a>
            </div>
          </div>
          <div className={styles.visual}>
            <ul className={styles.legend} aria-label="Map legend">
              <li><span className={styles.legendSolid} aria-hidden="true" />Selected route</li>
              <li><span className={styles.legendOther} aria-hidden="true" />Other trips</li>
              <li><span className={styles.legendMark} aria-hidden="true" />Vehicle</li>
            </ul>
            <div className={styles.bleed}>
              <DispatchIllustration />
            </div>
            <p className={styles.caption}>
              <span className={styles.captionText}>{landingCopy.hero.mapCaption}</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
