import { landingCopy } from "../../content/site";
import styles from "./sections.module.css";

export function TimeSpine() {
  return (
    <aside className={styles.timeSpine} aria-label="Page position through the sample day">
      <span className={styles.timeSpineLine} />
      {landingCopy.timeSpine.map((stop) => (
        <span className={styles.timeSpineStop} key={stop.time} style={{ top: `${stop.position}%` }}>
          <span className={styles.timeSpineDot} />
          <time className={styles.timeSpineTime}>{stop.time}</time>
        </span>
      ))}
      <span className={styles.timeSpineMarker} aria-hidden="true" />
    </aside>
  );
}
