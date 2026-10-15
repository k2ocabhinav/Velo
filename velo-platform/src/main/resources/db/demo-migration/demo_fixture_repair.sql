-- Local startup repair for the repeatable demo seed. The caller has already removed non-fixture rows.
CREATE TEMPORARY TABLE demo_fixture_request_seed (
    external_reference VARCHAR(255),
    tenant_slug VARCHAR(64),
    rider_email VARCHAR(255),
    request_status VARCHAR(32),
    request_age_minutes INTEGER,
    scheduled_after_minutes INTEGER,
    pickup_lon DOUBLE PRECISION,
    pickup_lat DOUBLE PRECISION,
    drop_lon DOUBLE PRECISION,
    drop_lat DOUBLE PRECISION,
    fare NUMERIC(10, 2),
    payment_method VARCHAR(32),
    pickup_address VARCHAR(255),
    drop_off_address VARCHAR(255)
);

INSERT INTO demo_fixture_request_seed VALUES
    ('DEMO-VELO-PENDING-01', 'default', 'dave@example.com', 'PENDING', 4, NULL, 77.5946, 12.9716, 77.7060, 13.1986, 185.00, 'CASH', 'Cubbon Park, Bengaluru', 'Kempegowda International Airport, Terminal 1'),
    ('DEMO-VELO-SCHEDULED-01', 'default', 'alice@example.com', 'SCHEDULED', 0, 1440, 77.5846, 12.9842, 77.5963, 12.9716, 145.00, 'CASH', 'Taj West End, Bengaluru', 'UB City, Bengaluru'),
    ('DEMO-VELO-SCHEDULED-02', 'default', 'frank@example.com', 'SCHEDULED', 0, 4320, 77.6408, 12.9784, 77.7060, 13.1986, 205.00, 'WALLET', 'Indiranagar Metro, Bengaluru', 'Kempegowda International Airport, Terminal 1'),
    ('DEMO-SAFFRON-PENDING-01', 'saffron-routes', 'guest2@saffronroutes.demo', 'PENDING', 4, NULL, 77.6050, 12.9729, 77.7060, 13.1986, 1425.00, 'CASH', 'Trinity Circle, Bengaluru', 'Kempegowda International Airport, Terminal 1'),
    ('DEMO-SAFFRON-SCHEDULED-01', 'saffron-routes', 'guest2@saffronroutes.demo', 'SCHEDULED', 0, 120, 77.5950, 12.9666, 77.7060, 13.1986, 1350.00, 'WALLET', 'ITC Gardenia, Bengaluru', 'Kempegowda International Airport, Terminal 1'),
    ('DEMO-SAFFRON-SCHEDULED-02', 'saffron-routes', 'guest2@saffronroutes.demo', 'SCHEDULED', 0, 240, 77.5846, 12.9842, 77.5713, 12.9767, 820.00, 'WALLET', 'Taj West End, Bengaluru', 'KSR Bengaluru City Railway Station'),
    ('DEMO-VELO-RIDE-ENDED-01', 'default', 'alice@example.com', 'EXPIRED', 5760, NULL, 77.5946, 12.9716, 77.6200, 12.9350, 640.00, 'CASH', 'Cubbon Park, Bengaluru', 'JP Nagar, Bengaluru'),
    ('DEMO-VELO-RIDE-CANCELLED-01', 'default', 'dave@example.com', 'CANCELLED', 4320, NULL, 77.5848, 12.9507, 77.5946, 12.9716, 90.00, 'CASH', 'Lalbagh Botanical Garden, Bengaluru', 'Cubbon Park, Bengaluru'),
    ('DEMO-VELO-RIDE-ONGOING-01', 'default', 'alice@example.com', 'CONFIRMED', 0, NULL, 77.5946, 12.9716, 77.6200, 12.9350, 640.00, 'CASH', 'Cubbon Park, Bengaluru', 'JP Nagar, Bengaluru'),
    ('DEMO-VELO-RIDE-ENDED-02', 'default', 'dave@example.com', 'EXPIRED', 4320, NULL, 77.5846, 12.9842, 77.5963, 12.9716, 200.00, 'CASH', 'Taj West End, Bengaluru', 'UB City, Bengaluru'),
    ('DEMO-VELO-RIDE-ENDED-03', 'default', 'alice@example.com', 'EXPIRED', 2880, NULL, 77.5946, 12.9716, 77.6200, 12.9350, 640.00, 'CASH', 'Cubbon Park, Bengaluru', 'JP Nagar, Bengaluru'),
    ('DEMO-SAFFRON-RIDE-ENDED-01', 'saffron-routes', 'guest@saffronroutes.demo', 'EXPIRED', 2880, NULL, 77.6200, 12.9350, 77.7060, 13.1986, 1450.00, 'CASH', 'JP Nagar, Bengaluru', 'Kempegowda International Airport, Terminal 1'),
    ('DEMO-SAFFRON-RIDE-ENDED-02', 'saffron-routes', 'guest2@saffronroutes.demo', 'EXPIRED', 1440, NULL, 77.5950, 12.9750, 77.6100, 12.9700, 825.00, 'CASH', 'Cubbon Park, Bengaluru', 'Trinity Circle, Bengaluru'),
    ('DEMO-SAFFRON-RIDE-ONGOING-01', 'saffron-routes', 'guest2@saffronroutes.demo', 'CONFIRMED', 0, NULL, 77.6100, 12.9350, 77.7060, 13.1986, 1580.00, 'CASH', 'JP Nagar, Bengaluru', 'Kempegowda International Airport, Terminal 1');

UPDATE ride_request request
SET rider_id = rider.id,
    payment_method = seed.payment_method,
    ride_request_status = seed.request_status,
    requested_time = NOW() - seed.request_age_minutes * INTERVAL '1 minute',
    scheduled_time = CASE WHEN seed.scheduled_after_minutes IS NULL THEN NULL
                          ELSE NOW() + seed.scheduled_after_minutes * INTERVAL '1 minute' END,
    pickup_location = ST_SetSRID(ST_MakePoint(seed.pickup_lon, seed.pickup_lat), 4326),
    drop_off_location = ST_SetSRID(ST_MakePoint(seed.drop_lon, seed.drop_lat), 4326),
    fare = seed.fare,
    customer_name = concat(app_user.first_name, ' ', app_user.last_name),
    customer_phone = app_user.phone_number,
    pickup_address = seed.pickup_address,
    drop_off_address = seed.drop_off_address
FROM demo_fixture_request_seed seed
JOIN tenant ON tenant.slug = seed.tenant_slug
JOIN app_user ON app_user.email = seed.rider_email AND app_user.tenant_id = tenant.id
JOIN rider ON rider.user_id = app_user.id AND rider.tenant_id = tenant.id
WHERE request.tenant_id = tenant.id
  AND request.external_reference = seed.external_reference;

INSERT INTO ride_request (
    pickup_location, drop_off_location, requested_time, scheduled_time, rider_id, payment_method,
    ride_request_status, fare, version, tenant_id, customer_name, customer_phone,
    pickup_address, drop_off_address, external_reference
)
SELECT ST_SetSRID(ST_MakePoint(seed.pickup_lon, seed.pickup_lat), 4326),
       ST_SetSRID(ST_MakePoint(seed.drop_lon, seed.drop_lat), 4326),
       NOW() - seed.request_age_minutes * INTERVAL '1 minute',
       CASE WHEN seed.scheduled_after_minutes IS NULL THEN NULL
            ELSE NOW() + seed.scheduled_after_minutes * INTERVAL '1 minute' END,
       rider.id, seed.payment_method, seed.request_status, seed.fare, 0, tenant.id,
       concat(app_user.first_name, ' ', app_user.last_name), app_user.phone_number,
       seed.pickup_address, seed.drop_off_address, seed.external_reference
FROM demo_fixture_request_seed seed
JOIN tenant ON tenant.slug = seed.tenant_slug
JOIN app_user ON app_user.email = seed.rider_email AND app_user.tenant_id = tenant.id
JOIN rider ON rider.user_id = app_user.id AND rider.tenant_id = tenant.id
WHERE NOT EXISTS (
    SELECT 1 FROM ride_request existing
    WHERE existing.tenant_id = tenant.id AND existing.external_reference = seed.external_reference
);

CREATE TEMPORARY TABLE demo_fixture_ride_seed (
    external_reference VARCHAR(255),
    tenant_slug VARCHAR(64),
    request_reference VARCHAR(255),
    rider_email VARCHAR(255),
    driver_email VARCHAR(255),
    ride_status VARCHAR(32),
    created_age_minutes INTEGER,
    started_age_minutes INTEGER,
    ended_age_minutes INTEGER,
    fare NUMERIC(10, 2),
    otp VARCHAR(8)
);

INSERT INTO demo_fixture_ride_seed VALUES
    ('DEMO-VELO-ENDED-01', 'default', 'DEMO-VELO-RIDE-ENDED-01', 'alice@example.com', 'bob.driver@example.com', 'ENDED', 5760, 5735, 5702, 640.00, '1904'),
    ('DEMO-VELO-CANCELLED-01', 'default', 'DEMO-VELO-RIDE-CANCELLED-01', 'dave@example.com', 'carol.driver@example.com', 'CANCELLED', 4320, NULL, NULL, 90.00, '5678'),
    ('DEMO-VELO-ONGOING-01', 'default', 'DEMO-VELO-RIDE-ONGOING-01', 'alice@example.com', 'carol.driver@example.com', 'ONGOING', 18, 9, NULL, 640.00, '2468'),
    ('DEMO-VELO-ENDED-02', 'default', 'DEMO-VELO-RIDE-ENDED-02', 'dave@example.com', 'bob.driver@example.com', 'ENDED', 4320, 4295, 4262, 200.00, '1357'),
    ('DEMO-VELO-ENDED-03', 'default', 'DEMO-VELO-RIDE-ENDED-03', 'alice@example.com', 'bob.driver@example.com', 'ENDED', 2880, 2855, 2822, 640.00, '1904'),
    ('DEMO-SAFFRON-ENDED-01', 'saffron-routes', 'DEMO-SAFFRON-RIDE-ENDED-01', 'guest@saffronroutes.demo', 'chauffeur1@saffronroutes.demo', 'ENDED', 2880, 2855, 2822, 1450.00, '5182'),
    ('DEMO-SAFFRON-ENDED-02', 'saffron-routes', 'DEMO-SAFFRON-RIDE-ENDED-02', 'guest2@saffronroutes.demo', 'chauffeur2@saffronroutes.demo', 'ENDED', 1440, 1415, 1382, 825.00, '7394'),
    ('DEMO-SAFFRON-ONGOING-01', 'saffron-routes', 'DEMO-SAFFRON-RIDE-ONGOING-01', 'guest2@saffronroutes.demo', 'chauffeur2@saffronroutes.demo', 'ONGOING', 16, 7, NULL, 1580.00, '4826');

UPDATE ride
SET ride_request_id = request.id,
    rider_id = rider.id,
    driver_id = driver.id,
    pickup_location = request.pickup_location,
    drop_off_location = request.drop_off_location,
    created_time = NOW() - seed.created_age_minutes * INTERVAL '1 minute',
    started_at = CASE WHEN seed.started_age_minutes IS NULL THEN NULL
                      ELSE NOW() - seed.started_age_minutes * INTERVAL '1 minute' END,
    ended_at = CASE WHEN seed.ended_age_minutes IS NULL THEN NULL
                    ELSE NOW() - seed.ended_age_minutes * INTERVAL '1 minute' END,
    payment_method = 'CASH',
    ride_status = seed.ride_status,
    fare = seed.fare,
    otp = seed.otp
FROM demo_fixture_ride_seed seed
JOIN tenant ON tenant.slug = seed.tenant_slug
JOIN ride_request request ON request.tenant_id = tenant.id AND request.external_reference = seed.request_reference
JOIN app_user rider_user ON rider_user.email = seed.rider_email AND rider_user.tenant_id = tenant.id
JOIN rider ON rider.user_id = rider_user.id AND rider.tenant_id = tenant.id
JOIN app_user driver_user ON driver_user.email = seed.driver_email AND driver_user.tenant_id = tenant.id
JOIN driver ON driver.user_id = driver_user.id AND driver.tenant_id = tenant.id
WHERE ride.tenant_id = tenant.id
  AND ride.external_reference = seed.external_reference;

INSERT INTO ride (
    pickup_location, drop_off_location, created_time, started_at, ended_at, rider_id, driver_id,
    payment_method, ride_status, fare, otp, ride_request_id, external_reference, version, tenant_id
)
SELECT request.pickup_location, request.drop_off_location,
       NOW() - seed.created_age_minutes * INTERVAL '1 minute',
       CASE WHEN seed.started_age_minutes IS NULL THEN NULL
            ELSE NOW() - seed.started_age_minutes * INTERVAL '1 minute' END,
       CASE WHEN seed.ended_age_minutes IS NULL THEN NULL
            ELSE NOW() - seed.ended_age_minutes * INTERVAL '1 minute' END,
       rider.id, driver.id, 'CASH', seed.ride_status, seed.fare, seed.otp,
       request.id, seed.external_reference, 0, tenant.id
FROM demo_fixture_ride_seed seed
JOIN tenant ON tenant.slug = seed.tenant_slug
JOIN ride_request request ON request.tenant_id = tenant.id AND request.external_reference = seed.request_reference
JOIN app_user rider_user ON rider_user.email = seed.rider_email AND rider_user.tenant_id = tenant.id
JOIN rider ON rider.user_id = rider_user.id AND rider.tenant_id = tenant.id
JOIN app_user driver_user ON driver_user.email = seed.driver_email AND driver_user.tenant_id = tenant.id
JOIN driver ON driver.user_id = driver_user.id AND driver.tenant_id = tenant.id
WHERE NOT EXISTS (
    SELECT 1 FROM ride existing
    WHERE existing.tenant_id = tenant.id AND existing.external_reference = seed.external_reference
);

INSERT INTO admin_dispatch_audit (
    action_type, actor_user_id, ride_request_id, ride_id, previous_driver_id, next_driver_id,
    reason, created_at, tenant_id
)
SELECT seed.action_type, actor.id, request.id, ride.id, previous_driver.id, next_driver.id,
       seed.reason, ride.created_time + seed.minutes_after_creation * INTERVAL '1 minute', tenant.id
FROM (VALUES
    ('default', 'ASSIGN_REQUEST', 'DEMO-VELO-RIDE-ENDED-01', NULL::text, 'bob.driver@example.com', 'Assigned the closest available driver after the rider confirmed the pickup point.', 2),
    ('default', 'REASSIGN_RIDE', 'DEMO-VELO-RIDE-ENDED-02', 'carol.driver@example.com', 'bob.driver@example.com', 'Reassigned to Bob after Carol reported that her earlier appointment was running late.', 4),
    ('default', 'REASSIGN_RIDE', 'DEMO-VELO-RIDE-ONGOING-01', 'bob.driver@example.com', 'carol.driver@example.com', 'Moved the pickup to Carol when Bob reported a vehicle issue before departure.', 5),
    ('saffron-routes', 'ASSIGN_REQUEST', 'DEMO-SAFFRON-RIDE-ENDED-01', NULL::text, 'chauffeur1@saffronroutes.demo', 'Matched the airport transfer with Karan for the early terminal pickup.', 2),
    ('saffron-routes', 'REASSIGN_RIDE', 'DEMO-SAFFRON-RIDE-ENDED-02', 'chauffeur1@saffronroutes.demo', 'chauffeur2@saffronroutes.demo', 'Reassigned to Mehul after the guest requested help with additional luggage.', 4),
    ('saffron-routes', 'REASSIGN_RIDE', 'DEMO-SAFFRON-RIDE-ONGOING-01', 'chauffeur1@saffronroutes.demo', 'chauffeur2@saffronroutes.demo', 'Moved the airport pickup to Mehul after Karan reported a vehicle warning.', 5)
) AS seed(tenant_slug, action_type, request_reference, previous_driver_email, next_driver_email, reason, minutes_after_creation)
JOIN tenant ON tenant.slug = seed.tenant_slug
JOIN app_user actor ON actor.email = CASE tenant.slug
    WHEN 'default' THEN 'admin@velo-platform.com'
    ELSE 'owner@saffronroutes.demo'
END AND actor.tenant_id = tenant.id
JOIN ride_request request ON request.tenant_id = tenant.id AND request.external_reference = seed.request_reference
JOIN ride ON ride.ride_request_id = request.id AND ride.tenant_id = tenant.id
LEFT JOIN app_user previous_user ON previous_user.email = seed.previous_driver_email AND previous_user.tenant_id = tenant.id
LEFT JOIN driver previous_driver ON previous_driver.user_id = previous_user.id AND previous_driver.tenant_id = tenant.id
JOIN app_user next_user ON next_user.email = seed.next_driver_email AND next_user.tenant_id = tenant.id
JOIN driver next_driver ON next_driver.user_id = next_user.id AND next_driver.tenant_id = tenant.id
WHERE NOT EXISTS (
    SELECT 1 FROM admin_dispatch_audit existing
    WHERE existing.tenant_id = tenant.id
      AND existing.ride_request_id = request.id
      AND existing.action_type = seed.action_type
      AND existing.reason = seed.reason
);

DROP TABLE demo_fixture_ride_seed;
DROP TABLE demo_fixture_request_seed;
