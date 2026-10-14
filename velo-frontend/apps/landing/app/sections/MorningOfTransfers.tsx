import type { CSSProperties } from "react";
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
        <div className={styles.timeline} role="group" aria-label={copy.statusContext}>
          <p className={styles.timelineContext}>{copy.statusContext}</p>
          {SAMPLE_TRIPS.map((trip) => {
            const reached = (copy.stages as readonly string[]).indexOf(trip.status);
            const midStage = trip.status === "On trip";
            return (
              <article className={styles.timelineRow} key={trip.id}>
                <div className={styles.timelineTrip}>
                  <time className={styles.timelineTime}>{trip.time}</time>
                  <span className={styles.timelineRoute}>{trip.pickup} to {trip.dropoff}</span>
                </div>
                <ol className={styles.tripProgress} aria-label={`${trip.time} trip progress`}>
                  {copy.stages.map((stage, index) => {
                    const state = index < reached || (index === reached && !midStage)
                      ? "done"
                      : index === reached
                        ? "active"
                        : "idle";
                    const fill = state === "done" ? 100 : state === "active" ? 55 : 0;
                    return (
                      <li className={styles.progressSegment} data-state={state} key={stage}>
                        <span className={styles.progressBar}>
                          <span className={styles.progressFill} style={{ "--fill": `${fill}%` } as CSSProperties} />
                        </span>
                        <span className={styles.progressLabel}>{stage}</span>
                      </li>
                    );
                  })}
                </ol>
              </article>
            );
          })}
        </div>
        <p className={styles.sampleNote}>{copy.sampleNote}</p>
      </div>
    </section>
  );
}
