import tenantBranding from "./tenant-branding.json";

function pluralize(label: string): string {
  return /s$/i.test(label) ? label : `${label}s`;
}

/**
 * The tenant nouns the e2e app servers render. The Playwright web servers point
 * `VELO_API_BASE_URL` at the mock API, which serves `tenant-branding.json`, so
 * every screen is white-labelled. Deriving the expected copy from the same
 * fixture keeps the specs from drifting back to Velo's default nouns.
 */
const rider = tenantBranding.riderLabel;
const driver = tenantBranding.driverLabel;
const trip = tenantBranding.tripLabel;

export const tenantLabels = {
  rider,
  riders: pluralize(rider),
  riderWord: rider.toLowerCase(),
  ridersWord: pluralize(rider).toLowerCase(),
  driver,
  drivers: pluralize(driver),
  driverWord: driver.toLowerCase(),
  driversWord: pluralize(driver).toLowerCase(),
  trip,
  trips: pluralize(trip),
  tripWord: trip.toLowerCase(),
  tripsWord: pluralize(trip).toLowerCase(),
};
