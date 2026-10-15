const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE;
const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR;

export function formatCountdownDuration(remainingSeconds: number): string {
  const safeSeconds = Number.isFinite(remainingSeconds) ? Math.max(0, Math.ceil(remainingSeconds)) : 0;

  if (safeSeconds < SECONDS_PER_HOUR) {
    const minutes = Math.floor(safeSeconds / SECONDS_PER_MINUTE);
    const seconds = safeSeconds % SECONDS_PER_MINUTE;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  if (safeSeconds >= SECONDS_PER_DAY) {
    const days = Math.ceil(safeSeconds / SECONDS_PER_DAY);
    return `${days} day${days === 1 ? "" : "s"}`;
  }

  const totalMinutes = Math.ceil(safeSeconds / SECONDS_PER_MINUTE);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
}
