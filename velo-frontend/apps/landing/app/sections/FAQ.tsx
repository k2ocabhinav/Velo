import { landingCopy } from "../../content/site";
import styles from "./sections.module.css";

export function FAQ() {
  const copy = landingCopy.faq;
  return (
    <section className={`${styles.section} ${styles.tintNight} ${styles.faqSection}`} id="faq" aria-labelledby="faq-title">
      <div className={styles.container}>
        <div className={styles.faqLayout}>
          <div className={styles.sectionIntro}><p className={styles.eyebrow}>{copy.eyebrow}</p><h2 className={styles.sectionTitle} id="faq-title">{copy.title}</h2></div>
          <div className={styles.faqList}>
            {copy.items.map((item) => <details className={styles.faqItem} key={item.question}><summary>{item.question}<span aria-hidden="true" /></summary><p>{item.answer}</p></details>)}
          </div>
        </div>
      </div>
    </section>
  );
}
