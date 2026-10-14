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
            <p className={styles.stage}>{landingCopy.hero.stage}</p>
            <h1 className={styles.title} id="hero-title">{landingCopy.hero.title}</h1>
            <p className={styles.description}>{landingCopy.hero.description}</p>
            <div className={styles.actions}>
              <a className={styles.primary} href="#contact">{landingCopy.hero.bookDemo}</a>
              <a className={styles.secondary} href={demoLink.href} target={siteConfig.demoVideoUrl ? "_blank" : undefined} rel={siteConfig.demoVideoUrl ? "noreferrer" : undefined}>{demoLink.label}</a>
            </div>
            <ul className={styles.facts} aria-label="What the working demo covers">
              <li>Branded workspaces</li>
              <li>Live trip status</li>
              <li>Weekly recurring trips</li>
            </ul>
          </div>
          <div className={styles.visual}>
            <DispatchIllustration />
          </div>
        </div>
      </div>
      <div className={styles.sunrise} aria-hidden="true" />
    </section>
  );
}
