import { landingCopy, siteConfig } from "../../content/site";
import styles from "./sections.module.css";

export function FounderNote() {
  const { name, photoUrl, city } = siteConfig.founder;
  const copy = landingCopy.founder;
  return (
    <section className={`${styles.section} ${styles.founderSection}`} aria-labelledby="founder-title">
      <div className={styles.container}>
        <div className={styles.founderCopy}>
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <h2 className={styles.sectionTitle} id="founder-title">{copy.title}</h2>
          <p className={styles.founderNote}>{copy.note}</p>
          {(name || photoUrl || city) && (
            <div className={styles.founderDetails}>
              {photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img className={styles.founderPhoto} src={photoUrl} alt="" width="72" height="72" loading="lazy" />
              )}
              <div>{name && <p className={styles.founderName}>{name}</p>}{city && <p className={styles.founderCity}>{city}</p>}</div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
