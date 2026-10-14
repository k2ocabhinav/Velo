import type { ReactNode } from "react";
import styles from "./sections.module.css";

type DeviceFrameProps = {
  variant?: "laptop" | "phone";
  tilt?: "strong" | "gentle";
  children: ReactNode;
};

export function DeviceFrame({ variant = "laptop", tilt = "strong", children }: DeviceFrameProps) {
  const variantClass = variant === "phone" ? styles.devicePhone : styles.deviceLaptop;
  const tiltClass = tilt === "gentle" ? styles.deviceGentle : "";

  return (
    <div className={`${styles.device} ${variantClass} ${tiltClass}`}>
      <div className={styles.deviceTilt}>
        <div className={variant === "phone" ? styles.phoneFrame : styles.laptopFrame}>
          {children}
        </div>
      </div>
    </div>
  );
}
