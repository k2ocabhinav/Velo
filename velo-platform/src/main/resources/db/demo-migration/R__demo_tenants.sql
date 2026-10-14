-- Local/dev-only demo fixtures. Production Flyway locations must not include this directory.
-- Re-running this migration refreshes the named demo accounts and fixtures without duplicates.

INSERT INTO tenant (slug, name, active)
VALUES ('default', 'Velo Business', TRUE),
       ('saffron-routes', 'Saffron Routes', TRUE)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    active = TRUE;

INSERT INTO tenant_configuration (
    tenant_id, brand_name, primary_color, logo_url, rider_label, driver_label, trip_label, dispatch_mode, updated_at
)
SELECT id, 'Velo Business', '#1A56FF', NULL, 'Rider', 'Driver', 'Trip', 'FLEET_MANAGED', NOW()
FROM tenant
WHERE slug = 'default'
ON CONFLICT (tenant_id) DO UPDATE
SET brand_name = EXCLUDED.brand_name,
    primary_color = EXCLUDED.primary_color,
    logo_url = EXCLUDED.logo_url,
    rider_label = EXCLUDED.rider_label,
    driver_label = EXCLUDED.driver_label,
    trip_label = EXCLUDED.trip_label,
    dispatch_mode = EXCLUDED.dispatch_mode,
    updated_at = NOW();

INSERT INTO tenant_configuration (
    tenant_id, brand_name, primary_color, logo_url, rider_label, driver_label, trip_label, dispatch_mode, updated_at
)
SELECT id, 'Saffron Routes', '#8A3D2B', NULL, 'Guest', 'Chauffeur', 'Transfer', 'FLEET_MANAGED', NOW()
FROM tenant
WHERE slug = 'saffron-routes'
ON CONFLICT (tenant_id) DO UPDATE
SET brand_name = EXCLUDED.brand_name,
    primary_color = EXCLUDED.primary_color,
    logo_url = EXCLUDED.logo_url,
    rider_label = EXCLUDED.rider_label,
    driver_label = EXCLUDED.driver_label,
    trip_label = EXCLUDED.trip_label,
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
    ('bob.driver@example.com', 'KA03MN4102', 4.9::DOUBLE PRECISION, TRUE, 77.5946::DOUBLE PRECISION, 12.9716::DOUBLE PRECISION, 'default'),
    ('carol.driver@example.com', 'KA05QR7731', 4.8::DOUBLE PRECISION, FALSE, 77.6090::DOUBLE PRECISION, 12.9800::DOUBLE PRECISION, 'default'),
    ('chauffeur1@saffronroutes.demo', 'KA03ST2408', 4.9::DOUBLE PRECISION, TRUE, 77.6060::DOUBLE PRECISION, 12.9660::DOUBLE PRECISION, 'saffron-routes'),
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
    ('alice@example.com', 1250.00::NUMERIC, 'default'),
    ('bob.driver@example.com', 620.00::NUMERIC, 'default'),
    ('carol.driver@example.com', 485.00::NUMERIC, 'default'),
    ('dave@example.com', 390.00::NUMERIC, 'default'),
    ('guest@saffronroutes.demo', 2840.00::NUMERIC, 'saffron-routes'),
    ('guest2@saffronroutes.demo', 1675.00::NUMERIC, 'saffron-routes'),
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
    pickup_address = 'The Leela Palace, Old Airport Road',
    drop_off_address = 'Kempegowda International Airport, Terminal 1',
    external_reference = 'DEMO-VELO-PENDING-01',
    requested_time = NOW() - INTERVAL '5 minutes',
    fare = 185.00
FROM rider
JOIN app_user ON app_user.id = rider.user_id
JOIN tenant ON tenant.id = rider.tenant_id
WHERE request.rider_id = rider.id
  AND app_user.email = 'dave@example.com'
  AND tenant.slug = 'default'
  AND request.ride_request_status = 'PENDING'
  AND request.external_reference IS NULL;

INSERT INTO ride_request (
    pickup_location, drop_off_location, requested_time, rider_id, payment_method,
    ride_request_status, fare, version, tenant_id, customer_name, customer_phone,
    pickup_address, drop_off_address, external_reference
)
SELECT ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326),
       ST_SetSRID(ST_MakePoint(77.7060, 13.1986), 4326), NOW() - INTERVAL '5 minutes', rider.id,
       'CASH', 'PENDING', 185.00, 0, tenant.id, 'Dave Rider', '+91-9000000004',
       'The Leela Palace, Old Airport Road', 'Kempegowda International Airport, Terminal 1',
       'DEMO-VELO-PENDING-01'
FROM tenant
JOIN rider ON rider.tenant_id = tenant.id
JOIN app_user ON app_user.id = rider.user_id
WHERE tenant.slug = 'default'
  AND app_user.email = 'dave@example.com'
  AND NOT EXISTS (SELECT 1 FROM ride_request WHERE external_reference = 'DEMO-VELO-PENDING-01');

UPDATE ride_request request
SET customer_name = concat(app_user.first_name, ' ', app_user.last_name),
    customer_phone = app_user.phone_number,
    pickup_address = CASE WHEN request.id % 2 = 0 THEN 'Taj MG Road, Bengaluru' ELSE 'Indiranagar Metro, Bengaluru' END,
    drop_off_address = CASE WHEN request.id % 2 = 0 THEN 'Kempegowda International Airport' ELSE 'UB City, Bengaluru' END,
    scheduled_time = NOW() + ((request.id % 3) + 1) * INTERVAL '1 day'
FROM rider
JOIN app_user ON app_user.id = rider.user_id
JOIN tenant ON tenant.id = rider.tenant_id
WHERE request.rider_id = rider.id
  AND tenant.slug = 'default'
  AND request.ride_request_status = 'SCHEDULED';

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
    ('guest@saffronroutes.demo', 'Ananya Shah', 77.6200::DOUBLE PRECISION, 12.9350::DOUBLE PRECISION, 77.6450::DOUBLE PRECISION, 12.9550::DOUBLE PRECISION, 2, 1350.00::NUMERIC, 'ITC Gardenia, Bengaluru', 'Kempegowda International Airport', 'DEMO-SAFFRON-SCHEDULED-01'),
    ('guest2@saffronroutes.demo', 'Rohan Mehta', 77.5950::DOUBLE PRECISION, 12.9750::DOUBLE PRECISION, 77.6100::DOUBLE PRECISION, 12.9700::DOUBLE PRECISION, 3, 820.00::NUMERIC, 'Taj West End, Bengaluru', 'Bengaluru City Railway Station', 'DEMO-SAFFRON-SCHEDULED-02')
) AS seed(email, customer_name, pickup_lon, pickup_lat, drop_lon, drop_lat, advance_days, fare, pickup_address, drop_address, external_reference)
JOIN tenant ON tenant.slug = 'saffron-routes'
JOIN app_user ON app_user.email = seed.email
JOIN rider ON rider.user_id = app_user.id
WHERE NOT EXISTS (
    SELECT 1 FROM ride_request existing WHERE existing.external_reference = seed.external_reference
);

INSERT INTO ride_request (
    pickup_location, drop_off_location, requested_time, rider_id, payment_method,
    ride_request_status, fare, version, tenant_id, customer_name, customer_phone,
    pickup_address, drop_off_address, external_reference
)
SELECT ST_SetSRID(ST_MakePoint(77.6050, 12.9680), 4326),
       ST_SetSRID(ST_MakePoint(77.7060, 13.1986), 4326), NOW() - INTERVAL '3 minutes', rider.id,
       'CASH', 'PENDING', 1425.00, 0, tenant.id, 'Rohan Mehta', app_user.phone_number,
       'The Oberoi, Bengaluru', 'Kempegowda International Airport, Terminal 1',
       'DEMO-SAFFRON-PENDING-01'
FROM tenant
JOIN app_user ON app_user.email = 'guest2@saffronroutes.demo'
JOIN rider ON rider.user_id = app_user.id
WHERE tenant.slug = 'saffron-routes'
  AND NOT EXISTS (SELECT 1 FROM ride_request WHERE external_reference = 'DEMO-SAFFRON-PENDING-01');

-- Keep one pending offer ready for each demo fleet so the driver workflow is available after startup.
UPDATE ride_offer offer
SET status = 'OFFERED', offered_at = NOW() - INTERVAL '1 minute',
    expires_at = NOW() + INTERVAL '7 days', accepted_at = NULL,
    resolved_at = NULL, resolution_reason = NULL
FROM ride_request request
JOIN tenant ON tenant.id = request.tenant_id
WHERE offer.ride_request_id = request.id
  AND request.external_reference IN ('DEMO-VELO-PENDING-01', 'DEMO-SAFFRON-PENDING-01')
  AND tenant.slug IN ('default', 'saffron-routes');

INSERT INTO ride_offer (
    ride_request_id, driver_id, status, offered_at, expires_at, version, tenant_id
)
SELECT request.id, driver.id, 'OFFERED', NOW() - INTERVAL '1 minute', NOW() + INTERVAL '7 days', 0, tenant.id
FROM ride_request request
JOIN tenant ON tenant.id = request.tenant_id
JOIN app_user driver_user ON driver_user.email = CASE tenant.slug
    WHEN 'default' THEN 'bob.driver@example.com'
    ELSE 'chauffeur1@saffronroutes.demo'
END
JOIN driver ON driver.user_id = driver_user.id AND driver.tenant_id = tenant.id
WHERE request.external_reference IN ('DEMO-VELO-PENDING-01', 'DEMO-SAFFRON-PENDING-01')
  AND NOT EXISTS (
      SELECT 1 FROM ride_offer existing
      WHERE existing.ride_request_id = request.id
        AND existing.driver_id = driver.id
        AND existing.tenant_id = tenant.id
  );

-- Reuse the original Velo in-progress row, pairing Alice with Carol so Bob can accept a new request.
UPDATE ride
SET rider_id = (SELECT rider.id FROM rider JOIN app_user ON app_user.id = rider.user_id WHERE app_user.email = 'alice@example.com'),
    driver_id = (SELECT driver.id FROM driver JOIN app_user ON app_user.id = driver.user_id WHERE app_user.email = 'carol.driver@example.com'),
    pickup_location = ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326),
    drop_off_location = ST_SetSRID(ST_MakePoint(77.6200, 12.9350), 4326),
    created_time = NOW() - INTERVAL '18 minutes', started_at = NOW() - INTERVAL '9 minutes',
    ended_at = NULL, payment_method = 'CASH', ride_status = 'ONGOING', fare = 640.00, otp = '2468'
WHERE tenant_id = (SELECT id FROM tenant WHERE slug = 'default')
  AND otp = '2468'
  AND ride_status = 'ONGOING';

-- The original V2 sample marks Dave's assigned trip as CONFIRMED. Keep it as history so he can use his account
-- for the seeded dispatch request while the single active Velo trip remains available to show live tracking.
UPDATE ride
SET started_at = COALESCE(started_at, NOW() - INTERVAL '1 day'),
    ended_at = COALESCE(ended_at, NOW() - INTERVAL '23 hours'),
    ride_status = 'ENDED'
WHERE tenant_id = (SELECT id FROM tenant WHERE slug = 'default')
  AND otp = '1357'
  AND ride_status = 'CONFIRMED';

INSERT INTO ride (
    pickup_location, drop_off_location, created_time, started_at, ended_at, rider_id, driver_id,
    payment_method, ride_status, fare, otp, version, tenant_id
)
SELECT ST_SetSRID(ST_MakePoint(seed.pickup_lon, seed.pickup_lat), 4326),
       ST_SetSRID(ST_MakePoint(seed.drop_lon, seed.drop_lat), 4326),
       NOW() - seed.age_days * INTERVAL '1 day', NOW() - (seed.age_days * INTERVAL '1 day') + INTERVAL '25 minutes',
       NOW() - (seed.age_days * INTERVAL '1 day') + INTERVAL '58 minutes', rider.id, driver.id,
       'CASH', 'ENDED', seed.fare, seed.otp, 0, tenant.id
FROM (VALUES
    ('alice@example.com', 'bob.driver@example.com', 77.5946::DOUBLE PRECISION, 12.9716::DOUBLE PRECISION, 77.6200::DOUBLE PRECISION, 12.9350::DOUBLE PRECISION, 2, 640.00::NUMERIC, '1904', 'default'),
    ('guest@saffronroutes.demo', 'chauffeur1@saffronroutes.demo', 77.6200::DOUBLE PRECISION, 12.9350::DOUBLE PRECISION, 77.7060::DOUBLE PRECISION, 13.1986::DOUBLE PRECISION, 2, 1450.00::NUMERIC, '5182', 'saffron-routes'),
    ('guest2@saffronroutes.demo', 'chauffeur2@saffronroutes.demo', 77.5950::DOUBLE PRECISION, 12.9750::DOUBLE PRECISION, 77.6100::DOUBLE PRECISION, 12.9700::DOUBLE PRECISION, 1, 825.00::NUMERIC, '7394', 'saffron-routes')
) AS seed(rider_email, driver_email, pickup_lon, pickup_lat, drop_lon, drop_lat, age_days, fare, otp, tenant_slug)
JOIN tenant ON tenant.slug = seed.tenant_slug
JOIN app_user rider_user ON rider_user.email = seed.rider_email
JOIN rider ON rider.user_id = rider_user.id AND rider.tenant_id = tenant.id
JOIN app_user driver_user ON driver_user.email = seed.driver_email
JOIN driver ON driver.user_id = driver_user.id AND driver.tenant_id = tenant.id
WHERE NOT EXISTS (
    SELECT 1 FROM ride existing
    WHERE existing.tenant_id = tenant.id AND existing.otp = seed.otp
      AND existing.rider_id = rider.id AND existing.driver_id = driver.id
);

INSERT INTO ride (
    pickup_location, drop_off_location, created_time, started_at, ended_at, rider_id, driver_id,
    payment_method, ride_status, fare, otp, version, tenant_id
)
SELECT ST_SetSRID(ST_MakePoint(77.6100, 12.9350), 4326),
       ST_SetSRID(ST_MakePoint(77.7060, 13.1986), 4326),
       NOW() - INTERVAL '16 minutes', NOW() - INTERVAL '7 minutes', NULL,
       rider.id, driver.id, 'CASH', 'ONGOING', 1580.00, '4826', 0, tenant.id
FROM tenant
JOIN app_user rider_user ON rider_user.email = 'guest@saffronroutes.demo'
JOIN rider ON rider.user_id = rider_user.id AND rider.tenant_id = tenant.id
JOIN app_user driver_user ON driver_user.email = 'chauffeur2@saffronroutes.demo'
JOIN driver ON driver.user_id = driver_user.id AND driver.tenant_id = tenant.id
WHERE tenant.slug = 'saffron-routes'
  AND NOT EXISTS (
      SELECT 1 FROM ride existing
      WHERE existing.tenant_id = tenant.id AND existing.otp = '4826'
        AND existing.rider_id = rider.id AND existing.driver_id = driver.id
  );

INSERT INTO payment (payment_method, user_id, ride_id, amount, payment_status, payment_time, version, tenant_id)
SELECT ride.payment_method, rider.user_id, ride.id, ride.fare, 'CONFIRMED', ride.ended_at, 0, ride.tenant_id
FROM ride
JOIN rider ON rider.id = ride.rider_id AND rider.tenant_id = ride.tenant_id
WHERE ride.ride_status = 'ENDED'
  AND ride.otp IN ('1234', '1357', '1904', '5182', '7394')
  AND NOT EXISTS (SELECT 1 FROM payment WHERE payment.ride_id = ride.id);

INSERT INTO driver_earning (driver_id, ride_id, gross_fare, platform_commission, net_earning, created_time, version, tenant_id)
SELECT ride.driver_id, ride.id, ride.fare, round(ride.fare * 0.30, 2), round(ride.fare * 0.70, 2), ride.ended_at, 0, ride.tenant_id
FROM ride
WHERE ride.ride_status = 'ENDED'
  AND ride.otp IN ('1234', '1357', '1904', '5182', '7394')
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
