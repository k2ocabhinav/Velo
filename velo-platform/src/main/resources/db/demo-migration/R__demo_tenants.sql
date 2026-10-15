-- Local/dev-only demo fixtures. Production Flyway locations must not include this directory.
-- Re-running this migration refreshes the named demo accounts and fixtures without duplicates.

INSERT INTO tenant (slug, name, active)
VALUES ('default', 'Velo Business', TRUE),
       ('saffron-routes', 'Saffron Routes', TRUE)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    active = TRUE;

INSERT INTO tenant_configuration (
    tenant_id, brand_name, primary_color, logo_url, rider_label, driver_label, trip_label, currency, dispatch_mode, updated_at
)
SELECT id, 'Velo Business', '#1A56FF', NULL, 'Rider', 'Driver', 'Trip', 'USD', 'FLEET_MANAGED', NOW()
FROM tenant
WHERE slug = 'default'
ON CONFLICT (tenant_id) DO UPDATE
SET brand_name = EXCLUDED.brand_name,
    primary_color = EXCLUDED.primary_color,
    logo_url = EXCLUDED.logo_url,
    rider_label = EXCLUDED.rider_label,
    driver_label = EXCLUDED.driver_label,
    trip_label = EXCLUDED.trip_label,
    currency = EXCLUDED.currency,
    dispatch_mode = EXCLUDED.dispatch_mode,
    updated_at = NOW();

INSERT INTO tenant_configuration (
    tenant_id, brand_name, primary_color, logo_url, rider_label, driver_label, trip_label, currency, dispatch_mode, updated_at
)
SELECT id, 'Saffron Routes', '#8A3D2B', NULL, 'Guest', 'Chauffeur', 'Transfer', 'INR', 'FLEET_MANAGED', NOW()
FROM tenant
WHERE slug = 'saffron-routes'
ON CONFLICT (tenant_id) DO UPDATE
SET brand_name = EXCLUDED.brand_name,
    primary_color = EXCLUDED.primary_color,
    logo_url = EXCLUDED.logo_url,
    rider_label = EXCLUDED.rider_label,
    driver_label = EXCLUDED.driver_label,
    trip_label = EXCLUDED.trip_label,
    currency = EXCLUDED.currency,
    dispatch_mode = EXCLUDED.dispatch_mode,
    updated_at = NOW();

-- Shared demo password for every account below: password123
INSERT INTO app_user (first_name, last_name, email, password, phone_number, active, created_time, version, tenant_id)
SELECT seed.first_name, seed.last_name, seed.email,
       '$2y$10$Nt93cyP1zWSTQC12nvIGkO6OuFhozbuu48Kjv6Z0UMRtATnhYFy0a',
       seed.phone_number, TRUE, TIMESTAMP '2026-10-01 09:00:00', 0, tenant.id
FROM (VALUES
    ('Admin', 'User', 'admin@velo-platform.com', '+91-9999999999', 'default'),
    ('Alice', 'Rider', 'alice@example.com', '+91-9000000001', 'default'),
    ('Bob', 'Driver', 'bob.driver@example.com', '+91-9000000002', 'default'),
    ('Carol', 'Captain', 'carol.driver@example.com', '+91-9000000003', 'default'),
    ('Dave', 'Rider', 'dave@example.com', '+91-9000000004', 'default'),
    ('Ishita', 'Rao', 'owner@saffronroutes.demo', '+91-9900000101', 'saffron-routes'),
    ('Ananya', 'Shah', 'guest@saffronroutes.demo', '+91-9900000102', 'saffron-routes'),
    ('Rohan', 'Mehta', 'guest2@saffronroutes.demo', '+91-9900000103', 'saffron-routes'),
    ('Karan', 'Iyer', 'chauffeur1@saffronroutes.demo', '+91-9900000104', 'saffron-routes'),
    ('Mehul', 'Patel', 'chauffeur2@saffronroutes.demo', '+91-9900000105', 'saffron-routes')
) AS seed(first_name, last_name, email, phone_number, tenant_slug)
JOIN tenant ON tenant.slug = seed.tenant_slug
ON CONFLICT (email) DO UPDATE
SET first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    password = EXCLUDED.password,
    phone_number = EXCLUDED.phone_number,
    active = TRUE,
    tenant_id = EXCLUDED.tenant_id;

INSERT INTO user_roles (user_id, roles)
SELECT app_user.id, assigned.role
FROM (VALUES
    ('admin@velo-platform.com', 'ADMIN'),
    ('alice@example.com', 'RIDER'),
    ('bob.driver@example.com', 'RIDER'),
    ('bob.driver@example.com', 'DRIVER'),
    ('carol.driver@example.com', 'RIDER'),
    ('carol.driver@example.com', 'DRIVER'),
    ('dave@example.com', 'RIDER'),
    ('owner@saffronroutes.demo', 'ADMIN'),
    ('guest@saffronroutes.demo', 'RIDER'),
    ('guest2@saffronroutes.demo', 'RIDER'),
    ('chauffeur1@saffronroutes.demo', 'DRIVER'),
    ('chauffeur2@saffronroutes.demo', 'DRIVER')
) AS assigned(email, role)
JOIN app_user ON app_user.email = assigned.email
ON CONFLICT (user_id, roles) DO NOTHING;

INSERT INTO rider (user_id, rating, version, tenant_id)
SELECT app_user.id, seed.rating, 0, tenant.id
FROM (VALUES
    ('alice@example.com', 4.9::DOUBLE PRECISION, 'default'),
    ('bob.driver@example.com', 4.8::DOUBLE PRECISION, 'default'),
    ('carol.driver@example.com', 4.7::DOUBLE PRECISION, 'default'),
    ('dave@example.com', 4.6::DOUBLE PRECISION, 'default'),
    ('guest@saffronroutes.demo', 4.9::DOUBLE PRECISION, 'saffron-routes'),
    ('guest2@saffronroutes.demo', 4.8::DOUBLE PRECISION, 'saffron-routes')
) AS seed(email, rating, tenant_slug)
JOIN app_user ON app_user.email = seed.email
JOIN tenant ON tenant.slug = seed.tenant_slug
ON CONFLICT (user_id) DO UPDATE
SET rating = EXCLUDED.rating,
    tenant_id = EXCLUDED.tenant_id;

INSERT INTO driver (
    user_id, vehicle_id, rating, available, onboarding_status, current_location, created_at, version, tenant_id
)
SELECT app_user.id, seed.vehicle_id, seed.rating, seed.available, 'APPROVED',
       ST_SetSRID(ST_MakePoint(seed.longitude, seed.latitude), 4326),
       TIMESTAMP '2026-10-01 09:30:00', 0, tenant.id
FROM (VALUES
    ('bob.driver@example.com', 'KA03MN4102', 4.9::DOUBLE PRECISION, FALSE, 77.5946::DOUBLE PRECISION, 12.9716::DOUBLE PRECISION, 'default'),
    ('carol.driver@example.com', 'KA05QR7731', 4.8::DOUBLE PRECISION, FALSE, 77.6090::DOUBLE PRECISION, 12.9800::DOUBLE PRECISION, 'default'),
    ('chauffeur1@saffronroutes.demo', 'KA03ST2408', 4.9::DOUBLE PRECISION, FALSE, 77.6060::DOUBLE PRECISION, 12.9660::DOUBLE PRECISION, 'saffron-routes'),
    ('chauffeur2@saffronroutes.demo', 'KA03UV5816', 4.8::DOUBLE PRECISION, FALSE, 77.6200::DOUBLE PRECISION, 12.9850::DOUBLE PRECISION, 'saffron-routes')
) AS seed(email, vehicle_id, rating, available, longitude, latitude, tenant_slug)
JOIN app_user ON app_user.email = seed.email
JOIN tenant ON tenant.slug = seed.tenant_slug
ON CONFLICT (user_id) DO UPDATE
SET vehicle_id = EXCLUDED.vehicle_id,
    rating = EXCLUDED.rating,
    available = EXCLUDED.available,
    onboarding_status = EXCLUDED.onboarding_status,
    current_location = EXCLUDED.current_location,
    tenant_id = EXCLUDED.tenant_id;

INSERT INTO wallet (user_id, balance, version, tenant_id)
SELECT app_user.id, seed.balance, 0, tenant.id
FROM (VALUES
    ('alice@example.com', 2500.00::NUMERIC, 'default'),
    ('bob.driver@example.com', 620.00::NUMERIC, 'default'),
    ('carol.driver@example.com', 485.00::NUMERIC, 'default'),
    ('dave@example.com', 2500.00::NUMERIC, 'default'),
    ('henry@example.com', 2500.00::NUMERIC, 'default'),
    ('guest@saffronroutes.demo', 25000.00::NUMERIC, 'saffron-routes'),
    ('guest2@saffronroutes.demo', 25000.00::NUMERIC, 'saffron-routes'),
    ('chauffeur1@saffronroutes.demo', 740.00::NUMERIC, 'saffron-routes'),
    ('chauffeur2@saffronroutes.demo', 610.00::NUMERIC, 'saffron-routes')
) AS seed(email, balance, tenant_slug)
JOIN app_user ON app_user.email = seed.email
JOIN tenant ON tenant.slug = seed.tenant_slug
ON CONFLICT (user_id) DO UPDATE
SET balance = EXCLUDED.balance,
    tenant_id = EXCLUDED.tenant_id;

-- Give the original Velo pending request readable pickup/drop-off details.
UPDATE ride_request request
SET customer_name = 'Dave Rider',
    customer_phone = '+91-9000000004',
    pickup_address = 'Cubbon Park, Bengaluru',
    drop_off_address = 'Kempegowda International Airport, Terminal 1',
    external_reference = 'DEMO-VELO-PENDING-01',
    requested_time = NOW() - INTERVAL '5 minutes',
    fare = 185.00
FROM rider
JOIN app_user ON app_user.id = rider.user_id
JOIN tenant ON tenant.id = rider.tenant_id
WHERE request.rider_id = rider.id
  AND request.id = 1
  AND app_user.email = 'dave@example.com'
  AND tenant.slug = 'default';

INSERT INTO ride_request (
    pickup_location, drop_off_location, requested_time, rider_id, payment_method,
    ride_request_status, fare, version, tenant_id, customer_name, customer_phone,
    pickup_address, drop_off_address, external_reference
)
SELECT ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326),
       ST_SetSRID(ST_MakePoint(77.7060, 13.1986), 4326), NOW() - INTERVAL '5 minutes', rider.id,
       'CASH', 'PENDING', 185.00, 0, tenant.id, 'Dave Rider', '+91-9000000004',
       'Cubbon Park, Bengaluru', 'Kempegowda International Airport, Terminal 1',
       'DEMO-VELO-PENDING-01'
FROM tenant
JOIN rider ON rider.tenant_id = tenant.id
JOIN app_user ON app_user.id = rider.user_id
WHERE tenant.slug = 'default'
  AND app_user.email = 'dave@example.com'
  AND NOT EXISTS (SELECT 1 FROM ride_request WHERE external_reference = 'DEMO-VELO-PENDING-01');

-- V2 seeds the third request for Henry, a presenter account the refresher clears on every startup.
-- Re-point it to Frank so the scheduled fixture belongs to a durable rider before its reference is assigned.
UPDATE ride_request request
SET rider_id = (
        SELECT rider.id
        FROM rider
        JOIN app_user ON app_user.id = rider.user_id
        JOIN tenant ON tenant.id = rider.tenant_id
        WHERE tenant.slug = 'default' AND app_user.email = 'frank@example.com'
    )
FROM rider
JOIN app_user ON app_user.id = rider.user_id
JOIN tenant ON tenant.id = rider.tenant_id
WHERE request.rider_id = rider.id
  AND request.id = 3
  AND tenant.slug = 'default'
  AND request.ride_request_status = 'SCHEDULED'
  AND request.external_reference IS NULL
  AND app_user.email = 'henry@example.com';

UPDATE ride_request request
SET customer_name = concat(app_user.first_name, ' ', app_user.last_name),
    customer_phone = app_user.phone_number,
    pickup_location = CASE request.id
        WHEN 2 THEN ST_SetSRID(ST_MakePoint(77.5846, 12.9842), 4326)
        ELSE ST_SetSRID(ST_MakePoint(77.6408, 12.9784), 4326)
    END,
    drop_off_location = CASE request.id
        WHEN 2 THEN ST_SetSRID(ST_MakePoint(77.5963, 12.9716), 4326)
        ELSE ST_SetSRID(ST_MakePoint(77.7060, 13.1986), 4326)
    END,
    pickup_address = CASE WHEN request.id = 2 THEN 'Taj West End, Bengaluru' ELSE 'Indiranagar Metro, Bengaluru' END,
    drop_off_address = CASE WHEN request.id = 2 THEN 'UB City, Bengaluru' ELSE 'Kempegowda International Airport, Terminal 1' END,
    scheduled_time = NOW() + ((request.id % 3) + 1) * INTERVAL '1 day',
    external_reference = CASE app_user.email
        WHEN 'alice@example.com' THEN 'DEMO-VELO-SCHEDULED-01'
        WHEN 'frank@example.com' THEN 'DEMO-VELO-SCHEDULED-02'
        ELSE request.external_reference
    END
FROM rider
JOIN app_user ON app_user.id = rider.user_id
JOIN tenant ON tenant.id = rider.tenant_id
WHERE request.rider_id = rider.id
  AND request.id IN (2, 3)
  AND tenant.slug = 'default'
  AND request.ride_request_status = 'SCHEDULED'
  AND app_user.email IN ('alice@example.com', 'frank@example.com');

-- Databases that ran older seed versions may have already lost the Henry request the refresher clears.
-- Recreate the Frank scheduled transfer so the fixture exists everywhere it is expected.
INSERT INTO ride_request (
    pickup_location, drop_off_location, requested_time, scheduled_time, rider_id, payment_method,
    ride_request_status, fare, version, tenant_id, customer_name, customer_phone,
    pickup_address, drop_off_address, external_reference
)
SELECT ST_SetSRID(ST_MakePoint(77.6408, 12.9784), 4326),
       ST_SetSRID(ST_MakePoint(77.7060, 13.1986), 4326), NOW(),
       NOW() + INTERVAL '3 days', rider.id, 'WALLET', 'SCHEDULED',
       205.00, 0, tenant.id, concat(app_user.first_name, ' ', app_user.last_name), app_user.phone_number,
       'Indiranagar Metro, Bengaluru', 'Kempegowda International Airport, Terminal 1', 'DEMO-VELO-SCHEDULED-02'
FROM tenant
JOIN app_user ON app_user.email = 'frank@example.com'
JOIN rider ON rider.user_id = app_user.id AND rider.tenant_id = tenant.id
WHERE tenant.slug = 'default'
  AND NOT EXISTS (SELECT 1 FROM ride_request existing WHERE existing.external_reference = 'DEMO-VELO-SCHEDULED-02');

INSERT INTO ride_request (
    pickup_location, drop_off_location, requested_time, scheduled_time, rider_id, payment_method,
    ride_request_status, fare, version, tenant_id, customer_name, customer_phone,
    pickup_address, drop_off_address, external_reference
)
SELECT ST_SetSRID(ST_MakePoint(seed.pickup_lon, seed.pickup_lat), 4326),
       ST_SetSRID(ST_MakePoint(seed.drop_lon, seed.drop_lat), 4326), NOW(),
       NOW() + seed.advance_days * INTERVAL '1 day', rider.id, 'WALLET', 'SCHEDULED',
       seed.fare, 0, tenant.id, seed.customer_name, app_user.phone_number,
       seed.pickup_address, seed.drop_address, seed.external_reference
FROM (VALUES
    ('guest2@saffronroutes.demo', 'Rohan Mehta', 77.5950::DOUBLE PRECISION, 12.9666::DOUBLE PRECISION, 77.7060::DOUBLE PRECISION, 13.1986::DOUBLE PRECISION, 2, 1350.00::NUMERIC, 'ITC Gardenia, Bengaluru', 'Kempegowda International Airport, Terminal 1', 'DEMO-SAFFRON-SCHEDULED-01'),
    ('guest2@saffronroutes.demo', 'Rohan Mehta', 77.5846::DOUBLE PRECISION, 12.9842::DOUBLE PRECISION, 77.5713::DOUBLE PRECISION, 12.9767::DOUBLE PRECISION, 3, 820.00::NUMERIC, 'Taj West End, Bengaluru', 'KSR Bengaluru City Railway Station', 'DEMO-SAFFRON-SCHEDULED-02')
) AS seed(email, customer_name, pickup_lon, pickup_lat, drop_lon, drop_lat, advance_days, fare, pickup_address, drop_address, external_reference)
JOIN tenant ON tenant.slug = 'saffron-routes'
JOIN app_user ON app_user.email = seed.email
JOIN rider ON rider.user_id = app_user.id
WHERE NOT EXISTS (
    SELECT 1 FROM ride_request existing WHERE existing.external_reference = seed.external_reference
);

UPDATE ride_request request
SET rider_id = rider.id,
    customer_name = concat(app_user.first_name, ' ', app_user.last_name),
    customer_phone = app_user.phone_number
FROM tenant
JOIN app_user ON app_user.email = 'guest2@saffronroutes.demo' AND app_user.tenant_id = tenant.id
JOIN rider ON rider.user_id = app_user.id AND rider.tenant_id = tenant.id
WHERE tenant.slug = 'saffron-routes'
  AND request.tenant_id = tenant.id
  AND request.external_reference = 'DEMO-SAFFRON-SCHEDULED-01';

INSERT INTO ride_request (
    pickup_location, drop_off_location, requested_time, rider_id, payment_method,
    ride_request_status, fare, version, tenant_id, customer_name, customer_phone,
    pickup_address, drop_off_address, external_reference
)
SELECT ST_SetSRID(ST_MakePoint(77.6050, 12.9729), 4326),
       ST_SetSRID(ST_MakePoint(77.7060, 13.1986), 4326), NOW() - INTERVAL '3 minutes', rider.id,
       'CASH', 'PENDING', 1425.00, 0, tenant.id, 'Rohan Mehta', app_user.phone_number,
       'Trinity Circle, Bengaluru', 'Kempegowda International Airport, Terminal 1',
       'DEMO-SAFFRON-PENDING-01'
FROM tenant
JOIN app_user ON app_user.email = 'guest2@saffronroutes.demo'
JOIN rider ON rider.user_id = app_user.id
WHERE tenant.slug = 'saffron-routes'
  AND NOT EXISTS (SELECT 1 FROM ride_request WHERE external_reference = 'DEMO-SAFFRON-PENDING-01');

UPDATE ride_request request
SET pickup_location = ST_SetSRID(ST_MakePoint(seed.pickup_lon, seed.pickup_lat), 4326),
    drop_off_location = ST_SetSRID(ST_MakePoint(seed.drop_lon, seed.drop_lat), 4326),
    pickup_address = seed.pickup_address,
    drop_off_address = seed.drop_address
FROM (VALUES
    ('DEMO-VELO-PENDING-01', 'default', 77.5946::DOUBLE PRECISION, 12.9716::DOUBLE PRECISION, 77.7060::DOUBLE PRECISION, 13.1986::DOUBLE PRECISION, 'Cubbon Park, Bengaluru', 'Kempegowda International Airport, Terminal 1'),
    ('DEMO-VELO-SCHEDULED-01', 'default', 77.5846::DOUBLE PRECISION, 12.9842::DOUBLE PRECISION, 77.5963::DOUBLE PRECISION, 12.9716::DOUBLE PRECISION, 'Taj West End, Bengaluru', 'UB City, Bengaluru'),
    ('DEMO-VELO-SCHEDULED-02', 'default', 77.6408::DOUBLE PRECISION, 12.9784::DOUBLE PRECISION, 77.7060::DOUBLE PRECISION, 13.1986::DOUBLE PRECISION, 'Indiranagar Metro, Bengaluru', 'Kempegowda International Airport, Terminal 1'),
    ('DEMO-SAFFRON-PENDING-01', 'saffron-routes', 77.6050::DOUBLE PRECISION, 12.9729::DOUBLE PRECISION, 77.7060::DOUBLE PRECISION, 13.1986::DOUBLE PRECISION, 'Trinity Circle, Bengaluru', 'Kempegowda International Airport, Terminal 1'),
    ('DEMO-SAFFRON-SCHEDULED-01', 'saffron-routes', 77.5950::DOUBLE PRECISION, 12.9666::DOUBLE PRECISION, 77.7060::DOUBLE PRECISION, 13.1986::DOUBLE PRECISION, 'ITC Gardenia, Bengaluru', 'Kempegowda International Airport, Terminal 1'),
    ('DEMO-SAFFRON-SCHEDULED-02', 'saffron-routes', 77.5846::DOUBLE PRECISION, 12.9842::DOUBLE PRECISION, 77.5713::DOUBLE PRECISION, 12.9767::DOUBLE PRECISION, 'Taj West End, Bengaluru', 'KSR Bengaluru City Railway Station')
) AS seed(reference, tenant_slug, pickup_lon, pickup_lat, drop_lon, drop_lat, pickup_address, drop_address)
JOIN tenant ON tenant.slug = seed.tenant_slug
WHERE request.tenant_id = tenant.id
  AND request.external_reference = seed.reference;

-- Keep one pending offer ready for each demo fleet so the driver workflow is available after startup.
DELETE FROM ride_offer
WHERE ride_request_id IN (
    SELECT id FROM ride_request
    WHERE external_reference IN ('DEMO-VELO-PENDING-01', 'DEMO-SAFFRON-PENDING-01')
);

INSERT INTO ride_offer (
    ride_request_id, driver_id, status, offered_at, expires_at, version, tenant_id
)
SELECT request.id, driver.id, 'OFFERED', NOW(), NOW() + INTERVAL '90 seconds', 0, tenant.id
FROM ride_request request
JOIN tenant ON tenant.id = request.tenant_id
JOIN app_user driver_user ON driver_user.email = CASE tenant.slug
    WHEN 'default' THEN 'carol.driver@example.com'
    ELSE 'chauffeur2@saffronroutes.demo'
END
JOIN driver ON driver.user_id = driver_user.id AND driver.tenant_id = tenant.id
WHERE request.external_reference IN ('DEMO-VELO-PENDING-01', 'DEMO-SAFFRON-PENDING-01')
  AND NOT EXISTS (
      SELECT 1 FROM ride_offer existing
      WHERE existing.ride_request_id = request.id
        AND existing.driver_id = driver.id
        AND existing.tenant_id = tenant.id
  );

-- Give only the known baseline fixture rows durable identities before resetting their demo state.
UPDATE ride
SET external_reference = CASE ride.id
    WHEN 1 THEN 'DEMO-VELO-ENDED-01'
    WHEN 2 THEN 'DEMO-VELO-CANCELLED-01'
    WHEN 3 THEN 'DEMO-VELO-ONGOING-01'
    WHEN 4 THEN 'DEMO-VELO-ENDED-02'
END
FROM tenant
JOIN rider ON rider.tenant_id = tenant.id
JOIN app_user rider_user ON rider_user.id = rider.user_id
JOIN driver ON driver.tenant_id = tenant.id
JOIN app_user driver_user ON driver_user.id = driver.user_id
WHERE ride.tenant_id = tenant.id
  AND tenant.slug = 'default'
  AND ride.rider_id = rider.id
  AND ride.driver_id = driver.id
  AND (
      (ride.id = 1 AND rider_user.email = 'alice@example.com' AND driver_user.email = 'bob.driver@example.com'
          AND ride.ride_status = 'ENDED' AND ride.fare = 150.00)
      OR (ride.id = 2 AND rider_user.email = 'dave@example.com' AND driver_user.email = 'carol.driver@example.com'
          AND ride.ride_status = 'CANCELLED' AND ride.fare = 90.00)
      OR (ride.id = 3 AND rider_user.email = 'bob.driver@example.com' AND driver_user.email = 'carol.driver@example.com'
          AND ride.ride_status = 'ONGOING' AND ride.fare = 120.00)
      OR (ride.id = 4 AND rider_user.email = 'dave@example.com' AND driver_user.email = 'bob.driver@example.com'
          AND ride.ride_status = 'CONFIRMED' AND ride.fare = 200.00)
  );

-- Backfill identities for the earlier repeatable-seed rows using their full fixture pairing and route.
UPDATE ride
SET external_reference = 'DEMO-VELO-ENDED-03'
FROM tenant
JOIN rider ON rider.tenant_id = tenant.id
JOIN app_user rider_user ON rider_user.id = rider.user_id
JOIN driver ON driver.tenant_id = tenant.id
JOIN app_user driver_user ON driver_user.id = driver.user_id
WHERE ride.tenant_id = tenant.id
  AND tenant.slug = 'default'
  AND ride.rider_id = rider.id
  AND ride.driver_id = driver.id
  AND rider_user.email = 'alice@example.com'
  AND driver_user.email = 'bob.driver@example.com'
  AND ride.ride_status = 'ENDED'
  AND ride.fare = 640.00
  AND ST_Equals(ride.pickup_location, ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326))
  AND ST_Equals(ride.drop_off_location, ST_SetSRID(ST_MakePoint(77.6200, 12.9350), 4326))
  AND ride.external_reference IS NULL;

UPDATE ride
SET external_reference = 'DEMO-SAFFRON-ENDED-01'
FROM tenant
JOIN rider ON rider.tenant_id = tenant.id
JOIN app_user rider_user ON rider_user.id = rider.user_id
JOIN driver ON driver.tenant_id = tenant.id
JOIN app_user driver_user ON driver_user.id = driver.user_id
WHERE ride.tenant_id = tenant.id
  AND tenant.slug = 'saffron-routes'
  AND ride.rider_id = rider.id
  AND ride.driver_id = driver.id
  AND rider_user.email = 'guest@saffronroutes.demo'
  AND driver_user.email = 'chauffeur1@saffronroutes.demo'
  AND ride.ride_status = 'ENDED'
  AND ride.fare = 1450.00
  AND ST_Equals(ride.pickup_location, ST_SetSRID(ST_MakePoint(77.6200, 12.9350), 4326))
  AND ST_Equals(ride.drop_off_location, ST_SetSRID(ST_MakePoint(77.7060, 13.1986), 4326))
  AND ride.external_reference IS NULL;

UPDATE ride
SET external_reference = 'DEMO-SAFFRON-ENDED-02'
FROM tenant
JOIN rider ON rider.tenant_id = tenant.id
JOIN app_user rider_user ON rider_user.id = rider.user_id
JOIN driver ON driver.tenant_id = tenant.id
JOIN app_user driver_user ON driver_user.id = driver.user_id
WHERE ride.tenant_id = tenant.id
  AND tenant.slug = 'saffron-routes'
  AND ride.rider_id = rider.id
  AND ride.driver_id = driver.id
  AND rider_user.email = 'guest2@saffronroutes.demo'
  AND driver_user.email = 'chauffeur2@saffronroutes.demo'
  AND ride.ride_status = 'ENDED'
  AND ride.fare = 825.00
  AND ST_Equals(ride.pickup_location, ST_SetSRID(ST_MakePoint(77.5950, 12.9750), 4326))
  AND ST_Equals(ride.drop_off_location, ST_SetSRID(ST_MakePoint(77.6100, 12.9700), 4326))
  AND ride.external_reference IS NULL;

UPDATE ride
SET external_reference = 'DEMO-SAFFRON-ONGOING-01'
FROM tenant
JOIN rider ON rider.tenant_id = tenant.id
JOIN app_user rider_user ON rider_user.id = rider.user_id
JOIN driver ON driver.tenant_id = tenant.id
JOIN app_user driver_user ON driver_user.id = driver.user_id
WHERE ride.tenant_id = tenant.id
  AND tenant.slug = 'saffron-routes'
  AND ride.rider_id = rider.id
  AND ride.driver_id = driver.id
  AND rider_user.email = 'guest@saffronroutes.demo'
  AND driver_user.email = 'chauffeur2@saffronroutes.demo'
  AND ride.ride_status = 'ONGOING'
  AND ride.fare = 1580.00
  AND ST_Equals(ride.pickup_location, ST_SetSRID(ST_MakePoint(77.6100, 12.9350), 4326))
  AND ST_Equals(ride.drop_off_location, ST_SetSRID(ST_MakePoint(77.7060, 13.1986), 4326))
  AND ride.external_reference IS NULL;

-- Reuse the original Velo in-progress row, pairing Alice with Carol so Bob can accept a new request.
UPDATE ride
SET rider_id = (SELECT rider.id FROM rider JOIN app_user ON app_user.id = rider.user_id WHERE app_user.email = 'alice@example.com'),
    driver_id = (SELECT driver.id FROM driver JOIN app_user ON app_user.id = driver.user_id WHERE app_user.email = 'carol.driver@example.com'),
    pickup_location = ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326),
    drop_off_location = ST_SetSRID(ST_MakePoint(77.6200, 12.9350), 4326),
    created_time = NOW() - INTERVAL '18 minutes', started_at = NOW() - INTERVAL '9 minutes',
    ended_at = NULL, payment_method = 'CASH', ride_status = 'ONGOING', fare = 640.00, otp = '2468'
WHERE tenant_id = (SELECT id FROM tenant WHERE slug = 'default')
  AND external_reference = 'DEMO-VELO-ONGOING-01';

-- The original V2 sample marks Dave's assigned trip as CONFIRMED. Keep it as history so he can use his account
-- for the seeded dispatch request while the single active Velo trip remains available to show live tracking.
UPDATE ride
SET started_at = COALESCE(started_at, NOW() - INTERVAL '1 day'),
    ended_at = COALESCE(ended_at, NOW() - INTERVAL '23 hours'),
    ride_status = 'ENDED'
WHERE tenant_id = (SELECT id FROM tenant WHERE slug = 'default')
  AND external_reference = 'DEMO-VELO-ENDED-02';

INSERT INTO ride (
    pickup_location, drop_off_location, created_time, started_at, ended_at, rider_id, driver_id,
    payment_method, ride_status, fare, otp, external_reference, version, tenant_id
)
SELECT ST_SetSRID(ST_MakePoint(seed.pickup_lon, seed.pickup_lat), 4326),
       ST_SetSRID(ST_MakePoint(seed.drop_lon, seed.drop_lat), 4326),
       NOW() - seed.age_days * INTERVAL '1 day', NOW() - (seed.age_days * INTERVAL '1 day') + INTERVAL '25 minutes',
       NOW() - (seed.age_days * INTERVAL '1 day') + INTERVAL '58 minutes', rider.id, driver.id,
       'CASH', 'ENDED', seed.fare, seed.otp, seed.external_reference, 0, tenant.id
FROM (VALUES
    ('alice@example.com', 'bob.driver@example.com', 77.5946::DOUBLE PRECISION, 12.9716::DOUBLE PRECISION, 77.6200::DOUBLE PRECISION, 12.9350::DOUBLE PRECISION, 2, 640.00::NUMERIC, '1904', 'DEMO-VELO-ENDED-03', 'default'),
    ('guest@saffronroutes.demo', 'chauffeur1@saffronroutes.demo', 77.6200::DOUBLE PRECISION, 12.9350::DOUBLE PRECISION, 77.7060::DOUBLE PRECISION, 13.1986::DOUBLE PRECISION, 2, 1450.00::NUMERIC, '5182', 'DEMO-SAFFRON-ENDED-01', 'saffron-routes'),
    ('guest2@saffronroutes.demo', 'chauffeur2@saffronroutes.demo', 77.5950::DOUBLE PRECISION, 12.9750::DOUBLE PRECISION, 77.6100::DOUBLE PRECISION, 12.9700::DOUBLE PRECISION, 1, 825.00::NUMERIC, '7394', 'DEMO-SAFFRON-ENDED-02', 'saffron-routes')
) AS seed(rider_email, driver_email, pickup_lon, pickup_lat, drop_lon, drop_lat, age_days, fare, otp, external_reference, tenant_slug)
JOIN tenant ON tenant.slug = seed.tenant_slug
JOIN app_user rider_user ON rider_user.email = seed.rider_email
JOIN rider ON rider.user_id = rider_user.id AND rider.tenant_id = tenant.id
JOIN app_user driver_user ON driver_user.email = seed.driver_email
JOIN driver ON driver.user_id = driver_user.id AND driver.tenant_id = tenant.id
WHERE NOT EXISTS (SELECT 1 FROM ride existing WHERE existing.external_reference = seed.external_reference);

INSERT INTO ride (
    pickup_location, drop_off_location, created_time, started_at, ended_at, rider_id, driver_id,
    payment_method, ride_status, fare, otp, external_reference, version, tenant_id
)
SELECT ST_SetSRID(ST_MakePoint(77.6100, 12.9350), 4326),
       ST_SetSRID(ST_MakePoint(77.7060, 13.1986), 4326),
       NOW() - INTERVAL '16 minutes', NOW() - INTERVAL '7 minutes', NULL,
       rider.id, driver.id, 'CASH', 'ONGOING', 1580.00, '4826', 'DEMO-SAFFRON-ONGOING-01', 0, tenant.id
FROM tenant
JOIN app_user rider_user ON rider_user.email = 'guest2@saffronroutes.demo'
JOIN rider ON rider.user_id = rider_user.id AND rider.tenant_id = tenant.id
JOIN app_user driver_user ON driver_user.email = 'chauffeur2@saffronroutes.demo'
JOIN driver ON driver.user_id = driver_user.id AND driver.tenant_id = tenant.id
WHERE tenant.slug = 'saffron-routes'
  AND NOT EXISTS (SELECT 1 FROM ride existing WHERE existing.external_reference = 'DEMO-SAFFRON-ONGOING-01');

-- Ride addresses live on ride_request, so give every seeded ride a stable address-bearing request.
INSERT INTO ride_request (
    pickup_location, drop_off_location, requested_time, rider_id, payment_method,
    ride_request_status, fare, version, tenant_id, customer_name, customer_phone,
    pickup_address, drop_off_address, external_reference
)
SELECT ST_SetSRID(ST_MakePoint(seed.pickup_lon, seed.pickup_lat), 4326),
       ST_SetSRID(ST_MakePoint(seed.drop_lon, seed.drop_lat), 4326),
       NOW() - seed.age_days * INTERVAL '1 day', rider.id, 'CASH', seed.request_status,
       seed.fare, 0, tenant.id, concat(app_user.first_name, ' ', app_user.last_name), app_user.phone_number,
       seed.pickup_address, seed.drop_address, seed.request_reference
FROM (VALUES
    ('DEMO-VELO-RIDE-ENDED-01', 'default', 'alice@example.com', 'EXPIRED', 4, 77.5946::DOUBLE PRECISION, 12.9716::DOUBLE PRECISION, 77.6200::DOUBLE PRECISION, 12.9350::DOUBLE PRECISION, 640.00::NUMERIC, 'Cubbon Park, Bengaluru', 'JP Nagar, Bengaluru'),
    ('DEMO-VELO-RIDE-CANCELLED-01', 'default', 'dave@example.com', 'CANCELLED', 3, 77.5848::DOUBLE PRECISION, 12.9507::DOUBLE PRECISION, 77.5946::DOUBLE PRECISION, 12.9716::DOUBLE PRECISION, 90.00::NUMERIC, 'Lalbagh Botanical Garden, Bengaluru', 'Cubbon Park, Bengaluru'),
    ('DEMO-VELO-RIDE-ONGOING-01', 'default', 'alice@example.com', 'CONFIRMED', 0, 77.5946::DOUBLE PRECISION, 12.9716::DOUBLE PRECISION, 77.6200::DOUBLE PRECISION, 12.9350::DOUBLE PRECISION, 640.00::NUMERIC, 'Cubbon Park, Bengaluru', 'JP Nagar, Bengaluru'),
    ('DEMO-VELO-RIDE-ENDED-02', 'default', 'dave@example.com', 'EXPIRED', 3, 77.5846::DOUBLE PRECISION, 12.9842::DOUBLE PRECISION, 77.5963::DOUBLE PRECISION, 12.9716::DOUBLE PRECISION, 200.00::NUMERIC, 'Taj West End, Bengaluru', 'UB City, Bengaluru'),
    ('DEMO-VELO-RIDE-ENDED-03', 'default', 'alice@example.com', 'EXPIRED', 2, 77.5946::DOUBLE PRECISION, 12.9716::DOUBLE PRECISION, 77.6200::DOUBLE PRECISION, 12.9350::DOUBLE PRECISION, 640.00::NUMERIC, 'Cubbon Park, Bengaluru', 'JP Nagar, Bengaluru'),
    ('DEMO-SAFFRON-RIDE-ENDED-01', 'saffron-routes', 'guest@saffronroutes.demo', 'EXPIRED', 2, 77.6200::DOUBLE PRECISION, 12.9350::DOUBLE PRECISION, 77.7060::DOUBLE PRECISION, 13.1986::DOUBLE PRECISION, 1450.00::NUMERIC, 'JP Nagar, Bengaluru', 'Kempegowda International Airport, Terminal 1'),
    ('DEMO-SAFFRON-RIDE-ENDED-02', 'saffron-routes', 'guest2@saffronroutes.demo', 'EXPIRED', 1, 77.5950::DOUBLE PRECISION, 12.9750::DOUBLE PRECISION, 77.6100::DOUBLE PRECISION, 12.9700::DOUBLE PRECISION, 825.00::NUMERIC, 'Cubbon Park, Bengaluru', 'Trinity Circle, Bengaluru'),
    ('DEMO-SAFFRON-RIDE-ONGOING-01', 'saffron-routes', 'guest2@saffronroutes.demo', 'CONFIRMED', 0, 77.6100::DOUBLE PRECISION, 12.9350::DOUBLE PRECISION, 77.7060::DOUBLE PRECISION, 13.1986::DOUBLE PRECISION, 1580.00::NUMERIC, 'JP Nagar, Bengaluru', 'Kempegowda International Airport, Terminal 1')
) AS seed(request_reference, tenant_slug, rider_email, request_status, age_days, pickup_lon, pickup_lat, drop_lon, drop_lat, fare, pickup_address, drop_address)
JOIN tenant ON tenant.slug = seed.tenant_slug
JOIN app_user ON app_user.email = seed.rider_email AND app_user.tenant_id = tenant.id
JOIN rider ON rider.user_id = app_user.id AND rider.tenant_id = tenant.id
WHERE NOT EXISTS (
    SELECT 1 FROM ride_request existing
    WHERE existing.tenant_id = tenant.id AND existing.external_reference = seed.request_reference
);

UPDATE ride_request request
SET scheduled_time = NULL,
    pickup_address = CASE request.external_reference
        WHEN 'DEMO-VELO-RIDE-ENDED-01' THEN 'Cubbon Park, Bengaluru'
        WHEN 'DEMO-VELO-RIDE-CANCELLED-01' THEN 'Lalbagh Botanical Garden, Bengaluru'
        WHEN 'DEMO-VELO-RIDE-ONGOING-01' THEN 'Cubbon Park, Bengaluru'
        WHEN 'DEMO-VELO-RIDE-ENDED-02' THEN 'Taj West End, Bengaluru'
        WHEN 'DEMO-VELO-RIDE-ENDED-03' THEN 'Cubbon Park, Bengaluru'
        WHEN 'DEMO-SAFFRON-RIDE-ENDED-01' THEN 'JP Nagar, Bengaluru'
        WHEN 'DEMO-SAFFRON-RIDE-ENDED-02' THEN 'Cubbon Park, Bengaluru'
        ELSE 'JP Nagar, Bengaluru'
    END,
    drop_off_address = CASE request.external_reference
        WHEN 'DEMO-VELO-RIDE-ENDED-01' THEN 'JP Nagar, Bengaluru'
        WHEN 'DEMO-VELO-RIDE-CANCELLED-01' THEN 'Cubbon Park, Bengaluru'
        WHEN 'DEMO-VELO-RIDE-ONGOING-01' THEN 'JP Nagar, Bengaluru'
        WHEN 'DEMO-VELO-RIDE-ENDED-02' THEN 'UB City, Bengaluru'
        WHEN 'DEMO-VELO-RIDE-ENDED-03' THEN 'JP Nagar, Bengaluru'
        WHEN 'DEMO-SAFFRON-RIDE-ENDED-01' THEN 'Kempegowda International Airport, Terminal 1'
        WHEN 'DEMO-SAFFRON-RIDE-ENDED-02' THEN 'Trinity Circle, Bengaluru'
        ELSE 'Kempegowda International Airport, Terminal 1'
    END
WHERE request.external_reference IN (
    'DEMO-VELO-RIDE-ENDED-01', 'DEMO-VELO-RIDE-CANCELLED-01', 'DEMO-VELO-RIDE-ONGOING-01',
    'DEMO-VELO-RIDE-ENDED-02', 'DEMO-VELO-RIDE-ENDED-03', 'DEMO-SAFFRON-RIDE-ENDED-01',
    'DEMO-SAFFRON-RIDE-ENDED-02', 'DEMO-SAFFRON-RIDE-ONGOING-01'
);

UPDATE ride_request request
SET rider_id = rider.id,
    customer_name = concat(app_user.first_name, ' ', app_user.last_name),
    customer_phone = app_user.phone_number
FROM tenant
JOIN app_user ON app_user.email = 'guest2@saffronroutes.demo' AND app_user.tenant_id = tenant.id
JOIN rider ON rider.user_id = app_user.id AND rider.tenant_id = tenant.id
WHERE tenant.slug = 'saffron-routes'
  AND request.tenant_id = tenant.id
  AND request.external_reference IN ('DEMO-SAFFRON-SCHEDULED-01', 'DEMO-SAFFRON-RIDE-ONGOING-01');

UPDATE ride
SET ride_request_id = request.id,
    rider_id = request.rider_id,
    pickup_location = request.pickup_location,
    drop_off_location = request.drop_off_location
FROM ride_request request
WHERE ride.tenant_id = request.tenant_id
  AND request.external_reference = CASE ride.external_reference
      WHEN 'DEMO-VELO-ENDED-01' THEN 'DEMO-VELO-RIDE-ENDED-01'
      WHEN 'DEMO-VELO-CANCELLED-01' THEN 'DEMO-VELO-RIDE-CANCELLED-01'
      WHEN 'DEMO-VELO-ONGOING-01' THEN 'DEMO-VELO-RIDE-ONGOING-01'
      WHEN 'DEMO-VELO-ENDED-02' THEN 'DEMO-VELO-RIDE-ENDED-02'
      WHEN 'DEMO-VELO-ENDED-03' THEN 'DEMO-VELO-RIDE-ENDED-03'
      WHEN 'DEMO-SAFFRON-ENDED-01' THEN 'DEMO-SAFFRON-RIDE-ENDED-01'
      WHEN 'DEMO-SAFFRON-ENDED-02' THEN 'DEMO-SAFFRON-RIDE-ENDED-02'
      WHEN 'DEMO-SAFFRON-ONGOING-01' THEN 'DEMO-SAFFRON-RIDE-ONGOING-01'
  END;

-- Recreate the two Velo fixture rides even if the original V2 rows were changed or deleted.
INSERT INTO ride (
    pickup_location, drop_off_location, created_time, started_at, ended_at, rider_id, driver_id,
    payment_method, ride_status, fare, otp, ride_request_id, external_reference, version, tenant_id
)
SELECT request.pickup_location, request.drop_off_location,
       NOW() - seed.age_minutes * INTERVAL '1 minute',
       CASE WHEN seed.ride_status = 'ONGOING' THEN NOW() - seed.started_minutes * INTERVAL '1 minute'
            ELSE NOW() - seed.age_minutes * INTERVAL '1 minute' + INTERVAL '25 minutes' END,
       CASE WHEN seed.ride_status = 'ONGOING' THEN NULL
            ELSE NOW() - seed.age_minutes * INTERVAL '1 minute' + INTERVAL '58 minutes' END,
       rider.id, driver.id, 'CASH', seed.ride_status, seed.fare, seed.otp,
       request.id, seed.external_reference, 0, tenant.id
FROM (VALUES
    ('DEMO-VELO-ONGOING-01', 'DEMO-VELO-RIDE-ONGOING-01', 'alice@example.com', 'carol.driver@example.com', 'ONGOING', 18, 9, 640.00::NUMERIC, '2468'),
    ('DEMO-VELO-ENDED-02', 'DEMO-VELO-RIDE-ENDED-02', 'dave@example.com', 'bob.driver@example.com', 'ENDED', 4320, 4295, 200.00::NUMERIC, '1357')
) AS seed(external_reference, request_reference, rider_email, driver_email, ride_status, age_minutes, started_minutes, fare, otp)
JOIN tenant ON tenant.slug = 'default'
JOIN ride_request request ON request.tenant_id = tenant.id AND request.external_reference = seed.request_reference
JOIN app_user rider_user ON rider_user.email = seed.rider_email AND rider_user.tenant_id = tenant.id
JOIN rider ON rider.user_id = rider_user.id AND rider.tenant_id = tenant.id
JOIN app_user driver_user ON driver_user.email = seed.driver_email AND driver_user.tenant_id = tenant.id
JOIN driver ON driver.user_id = driver_user.id AND driver.tenant_id = tenant.id
WHERE NOT EXISTS (
    SELECT 1 FROM ride existing
    WHERE existing.tenant_id = tenant.id AND existing.external_reference = seed.external_reference
);

INSERT INTO payment (payment_method, user_id, ride_id, amount, payment_status, payment_time, version, tenant_id)
SELECT ride.payment_method, rider.user_id, ride.id, ride.fare, 'PENDING', NULL, 0, ride.tenant_id
FROM ride
JOIN rider ON rider.id = ride.rider_id AND rider.tenant_id = ride.tenant_id
WHERE ride.ride_status IN ('CONFIRMED', 'ONGOING')
  AND NOT EXISTS (SELECT 1 FROM payment WHERE payment.ride_id = ride.id);

INSERT INTO payment (payment_method, user_id, ride_id, amount, payment_status, payment_time, version, tenant_id)
SELECT ride.payment_method, rider.user_id, ride.id, ride.fare, 'CONFIRMED', ride.ended_at, 0, ride.tenant_id
FROM ride
JOIN rider ON rider.id = ride.rider_id AND rider.tenant_id = ride.tenant_id
WHERE ride.ride_status = 'ENDED'
  AND ride.external_reference IN (
      'DEMO-VELO-ENDED-01', 'DEMO-VELO-ENDED-02', 'DEMO-VELO-ENDED-03',
      'DEMO-SAFFRON-ENDED-01', 'DEMO-SAFFRON-ENDED-02'
  )
  AND NOT EXISTS (SELECT 1 FROM payment WHERE payment.ride_id = ride.id);

INSERT INTO driver_earning (driver_id, ride_id, gross_fare, platform_commission, net_earning, created_time, version, tenant_id)
SELECT ride.driver_id, ride.id, ride.fare, round(ride.fare * 0.30, 2), round(ride.fare * 0.70, 2), ride.ended_at, 0, ride.tenant_id
FROM ride
WHERE ride.ride_status = 'ENDED'
  AND ride.external_reference IN (
      'DEMO-VELO-ENDED-01', 'DEMO-VELO-ENDED-02', 'DEMO-VELO-ENDED-03',
      'DEMO-SAFFRON-ENDED-01', 'DEMO-SAFFRON-ENDED-02'
  )
  AND NOT EXISTS (SELECT 1 FROM driver_earning WHERE driver_earning.ride_id = ride.id);

INSERT INTO payout_request (driver_id, amount, status, requested_at, processed_at, admin_note, version, tenant_id)
SELECT driver.id, seed.amount, seed.status, seed.requested_at, seed.processed_at, seed.admin_note, 0, tenant.id
FROM (VALUES
    ('chauffeur1@saffronroutes.demo', 1250.00::NUMERIC, 'PENDING', TIMESTAMP '2026-10-14 10:15:00', NULL::TIMESTAMP, 'Airport transfer earnings ready for review.'),
    ('chauffeur2@saffronroutes.demo', 980.00::NUMERIC, 'PROCESSED', TIMESTAMP '2026-10-13 15:20:00', TIMESTAMP '2026-10-13 16:05:00', 'Paid to registered bank account.')
) AS seed(driver_email, amount, status, requested_at, processed_at, admin_note)
JOIN tenant ON tenant.slug = 'saffron-routes'
JOIN app_user ON app_user.email = seed.driver_email
JOIN driver ON driver.user_id = app_user.id AND driver.tenant_id = tenant.id
WHERE NOT EXISTS (
    SELECT 1 FROM payout_request existing
    WHERE existing.driver_id = driver.id AND existing.tenant_id = tenant.id
      AND existing.amount = seed.amount AND existing.status = seed.status
      AND existing.requested_at = seed.requested_at
);

INSERT INTO notification (user_id, title, message, type, reference_id, read, created_time, version, tenant_id)
SELECT app_user.id, 'Transfer request received', 'A guest transfer is ready to review.', 'RIDE_REQUESTED', request.id, FALSE, NOW(), 0, tenant.id
FROM tenant
JOIN ride_request request ON request.tenant_id = tenant.id AND request.external_reference = 'DEMO-SAFFRON-PENDING-01'
JOIN app_user ON app_user.email = 'guest2@saffronroutes.demo'
WHERE tenant.slug = 'saffron-routes'
  AND NOT EXISTS (
      SELECT 1 FROM notification existing
      WHERE existing.tenant_id = tenant.id AND existing.user_id = app_user.id
        AND existing.reference_id = request.id AND existing.title = 'Transfer request received'
  );

-- Seed a small, repeatable operator history for each tenant's fixture fleet.
DELETE FROM admin_dispatch_audit
WHERE tenant_id IN (SELECT id FROM tenant WHERE slug IN ('default', 'saffron-routes'));

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
