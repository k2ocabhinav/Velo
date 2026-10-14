import { landingCopy, siteConfig } from "../../content/site";
import { DispatchIllustration } from "@velo/ui/landing";
import styles from "./sections.module.css";

export function Hero() {
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
            <DispatchIllustration />
          </div>
        </div>
      </div>
    </section>
  );
}
