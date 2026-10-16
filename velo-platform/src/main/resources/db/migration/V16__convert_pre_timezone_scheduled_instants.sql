-- Before V15, scheduled_time was stored as a UTC-shaped timestamp even for tenants
-- whose booked wall clock was local. requested_time is RideRequest's creation marker;
-- there is no separate created_at column. Compare it with Flyway's installed_on as
-- both are timezone-less timestamps in the server wall clock. Rows created afterward
-- already use the tenant zone and store scheduled_time as a UTC instant.
-- Scheduled requests with an attached ride have already entered dispatch and must
-- keep their established lifecycle timestamps.
DO $$
BEGIN
    -- Flyway runs this once. The guard also makes an operator reapplying this SQL
    -- after a successful migration harmless.
    IF NOT EXISTS (
        SELECT 1 FROM flyway_schema_history WHERE version = '16' AND success = TRUE
    ) THEN
        UPDATE ride_request request
        SET scheduled_time = request.scheduled_time AT TIME ZONE tenant.time_zone AT TIME ZONE 'UTC'
        FROM tenant
        CROSS JOIN LATERAL (
            SELECT installed_on AS installed_at
            FROM flyway_schema_history
            WHERE version = '15' AND success = TRUE
            ORDER BY installed_rank DESC
            LIMIT 1
        ) v15
        WHERE request.tenant_id = tenant.id
          AND tenant.time_zone <> 'UTC'
          AND request.requested_time < v15.installed_at
          AND request.scheduled_time AT TIME ZONE tenant.time_zone > CURRENT_TIMESTAMP
          AND request.ride_request_status = 'SCHEDULED'
          AND NOT EXISTS (
              SELECT 1 FROM ride dispatched WHERE dispatched.ride_request_id = request.id
          );
    END IF;
END
$$;
