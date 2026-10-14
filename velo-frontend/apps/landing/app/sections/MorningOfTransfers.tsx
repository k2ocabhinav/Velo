import { landingCopy } from "../../content/site";
import { SAMPLE_TRIPS } from "../../content/sample-trips";
import styles from "./sections.module.css";

export function MorningOfTransfers() {
  const copy = landingCopy.morning;
  return (
    <section className={`${styles.section} ${styles.morningSection}`} id="product" aria-labelledby="morning-title">
      <div className={styles.container}>
        <div className={styles.sectionIntro}>
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <h2 className={styles.sectionTitle} id="morning-title">{copy.title}</h2>
          <p className={styles.sectionDescription}>{copy.description}</p>
        </div>
        <div className={styles.timeline} aria-label="Sample day from 05:00 to 20:00">
          <div className={styles.timelineAxis} aria-hidden="true">{[copy.axisStart, copy.axisMiddleOne, copy.axisMiddleTwo, copy.axisEnd].map((time) => <span key={time}>{time}</span>)}</div>
          {SAMPLE_TRIPS.map((trip) => (
            <article className={styles.timelineRow} key={trip.id}>
              <div className={styles.timelineTrip}>
                <time className={styles.timelineTime}>{trip.time}</time>
                <span className={styles.timelineRoute}>{trip.pickup} to {trip.dropoff}</span>
              </div>
              <ol className={styles.tripProgress} aria-label={`${trip.time} trip progress`}>
                {copy.stages.map((stage, index) => (
                  <li className={index < Math.round(trip.progress * copy.stages.length) ? styles.stageComplete : undefined} key={stage}>
                    <span className={styles.stageMark} aria-hidden="true" />{stage}
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </div>
        <p className={styles.sampleNote}>{copy.sampleNote}</p>
      </div>
    </section>
  );
}
