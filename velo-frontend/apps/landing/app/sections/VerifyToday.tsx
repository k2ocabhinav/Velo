import { landingCopy, verifyFacts } from "../../content/site";
import styles from "./sections.module.css";

export function VerifyToday() {
  const copy = landingCopy.verify;
  const facts = [
    { value: copy.backendScope, label: copy.backend },
    { value: copy.endToEndScope, label: copy.endToEnd },
    {
      value: String(verifyFacts.demoTenants.length),
      label: `${copy.tenants}: ${verifyFacts.demoTenants.join(" + ")}`,
    },
  ];

  return (
    <section className={`${styles.section} ${styles.verifySection}`} id="verify" aria-labelledby="verify-title">
      <div className={styles.container}>
        <div className={styles.verifyHead}>
          <h2 className={styles.sectionTitle} id="verify-title">{copy.title}</h2>
          <p className={styles.sectionDescription}>{copy.description}</p>
        </div>
        <div className={styles.verifyCertificate}>
          <span className={styles.verifyStamp} aria-hidden="true">Build checks</span>
          <ul className={styles.verifyFacts} aria-label={copy.groupLabel}>
            {facts.map((fact) => (
              <li key={fact.label}>
                <span className={styles.verifyValue}>{fact.value}</span>
                <span className={styles.verifyLabel}>{fact.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
