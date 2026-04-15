-- Backfill missing earnings for already completed rides.
-- This makes the earnings ledger resilient to earlier end-trip settlement gaps.
INSERT INTO driver_earning (
    tenant_id,
    driver_id,
    ride_id,
    gross_fare,
    platform_commission,
    net_earning,
    created_time,
    version
)
SELECT
    COALESCE(r.tenant_id, 1) AS tenant_id,
    r.driver_id,
    r.id AS ride_id,
    ROUND(r.fare, 2) AS gross_fare,
    ROUND(r.fare * 0.30, 2) AS platform_commission,
    ROUND(r.fare - (r.fare * 0.30), 2) AS net_earning,
    COALESCE(r.ended_at, NOW()) AS created_time,
    0 AS version
FROM ride r
LEFT JOIN driver_earning e ON e.ride_id = r.id
WHERE e.id IS NULL
  AND r.ride_status = 'ENDED'
  AND r.driver_id IS NOT NULL
  AND r.fare IS NOT NULL
  AND r.fare > 0;
