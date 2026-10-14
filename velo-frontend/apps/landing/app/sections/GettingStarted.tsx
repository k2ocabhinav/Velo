import { landingCopy, siteConfig } from "../../content/site";
import styles from "./sections.module.css";

export function GettingStarted() {
  const copy = landingCopy.gettingStarted;
  return (
    <section className={`${styles.section} ${styles.startSection}`} aria-labelledby="start-title">
      <div className={styles.container}>
        <div className={styles.sectionIntro}>
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <h2 className={styles.sectionTitle} id="start-title">{copy.title}</h2>
          <p className={styles.sectionDescription}>{copy.description}</p>
        </div>
        <div className={styles.startGrid}>
          <article className={styles.startColumn}><h3>{copy.needsTitle}</h3><ul>{copy.needs.map((item) => <li key={item}>{item}</li>)}</ul></article>
          <article className={styles.startColumn}><h3>{copy.supportTitle}</h3><ul>{copy.support.map((item) => <li key={item}>{item}</li>)}</ul></article>
        </div>
        <a className={styles.textLink} href={siteConfig.demoContactAvailable ? "#contact" : "#how-it-works"}>
          {siteConfig.demoContactAvailable ? copy.link : copy.exploreLink}
        </a>
      </div>
    </section>
  );
}
