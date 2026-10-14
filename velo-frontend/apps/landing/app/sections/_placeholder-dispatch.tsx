"use client";

import { landingCopy } from "../../content/site";
import type { SampleTrip } from "../../content/sample-trips";
import styles from "./sections.module.css";

export type DispatchIllustrationProps = {
  trips: readonly SampleTrip[];
  selectedTripId: string;
  onSelectTrip: (tripId: string) => void;
};

export function DispatchIllustration({ trips, selectedTripId, onSelectTrip }: DispatchIllustrationProps) {
  const trip = trips.find((item) => item.id === selectedTripId) ?? trips[0];

  return (
    <div className={styles.dispatchScene}>
      <div className={styles.sceneFrame}>
        <svg className={styles.sceneSvg} viewBox="0 0 680 460" role="img" aria-labelledby="scene-title scene-description">
          <title id="scene-title">A neighbourhood with three transfer routes</title>
          <desc id="scene-description">A sample airport, hotel and business park connected by highlighted streets.</desc>
          <rect className={styles.sceneGround} width="680" height="460" rx="12" />
          <path className={styles.sceneRoad} d="M-20 330 700 130M-30 105 710 360M205-20 445 480M515-30 330 490" />
          <path className={styles.sceneRoadMark} d="M-20 330 700 130M-30 105 710 360M205-20 445 480M515-30 330 490" />
          <path className={styles.sceneRoute} d="M135 290C225 240 260 210 340 220S440 275 530 150" />
          <path className={styles.sceneRouteAlt} d="M135 290C245 280 360 300 435 275S500 230 530 150" />
          <g className={styles.sceneBlocks}>
            <rect x="34" y="40" width="105" height="58" rx="4" /><rect x="154" y="46" width="76" height="44" rx="4" />
            <rect x="276" y="42" width="116" height="52" rx="4" /><rect x="452" y="36" width="126" height="70" rx="4" />
            <rect x="39" y="139" width="90" height="48" rx="4" /><rect x="182" y="133" width="92" height="49" rx="4" />
            <rect x="360" y="122" width="98" height="49" rx="4" /><rect x="548" y="126" width="86" height="54" rx="4" />
            <rect x="27" y="369" width="117" height="53" rx="4" /><rect x="180" y="370" width="99" height="49" rx="4" />
            <rect x="383" y="375" width="113" height="44" rx="4" /><rect x="536" y="357" width="105" height="64" rx="4" />
          </g>
          <g className={styles.sceneLandmarks}>
            <rect x="55" y="221" width="158" height="104" rx="8" /><text x="72" y="249">Grand Hotel</text>
            <path d="M77 266h112M77 278h92M77 290h102" />
            <rect x="456" y="190" width="168" height="109" rx="8" /><text x="475" y="219">Business park</text>
            <path d="M478 239h119M478 253h96M478 267h110" />
            <rect x="258" y="293" width="142" height="54" rx="8" /><text x="275" y="325">Airport link</text>
          </g>
          <g className={styles.sceneVehicle} transform="translate(330 212) rotate(-15)">
            <rect width="46" height="23" rx="7" /><rect x="8" y="-4" width="24" height="8" rx="3" />
            <circle cx="11" cy="24" r="4" /><circle cx="35" cy="24" r="4" />
          </g>
          <circle className={styles.scenePin} cx="135" cy="290" r="11" /><circle className={styles.scenePinRing} cx="135" cy="290" r="18" />
          <circle className={styles.scenePinEnd} cx="530" cy="150" r="11" /><circle className={styles.scenePinRing} cx="530" cy="150" r="18" />
        </svg>
        <div className={styles.dispatchCard} aria-live="polite">
          <div className={styles.dispatchCardTop}><span>{landingCopy.hero.nextTransfer}</span><span className={styles.dispatchStatus}>{trip.status}</span></div>
          <p className={styles.dispatchTime}>{trip.time}</p>
          <p className={styles.dispatchRoute}>{trip.pickup} <span aria-hidden="true">to</span> {trip.dropoff}</p>
          <p className={styles.dispatchDriver}>{landingCopy.hero.driverLabel} {trip.driver}</p>
        </div>
      </div>
      <div className={styles.dispatchControls} role="group" aria-label="Sample transfers">
        {trips.map((item) => (
          <button className={styles.tripButton} key={item.id} type="button" aria-pressed={item.id === selectedTripId} onClick={() => onSelectTrip(item.id)}>{item.time}</button>
        ))}
      </div>
    </div>
  );
}
