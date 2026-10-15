-- Local/dev-only demo fixtures for the fleet simulator (docs/decisions/0024-demo-fleet-simulator-and-live-dispatch-map.md).
-- Production Flyway locations must not include this directory. Re-running this migration refreshes the
-- simulated accounts without duplicates. Shared demo password for every account below: password123

-- Flyway applies repeatable migrations in description order, so this file runs before R__demo_tenants.sql.
-- Create the demo tenants when they are missing; R__demo_tenants.sql stays the source of truth for their
-- branding and overwrites these rows when it applies.
INSERT INTO tenant (slug, name, active)
SELECT seed.slug, seed.name, TRUE
FROM (VALUES ('default', 'Velo Business'), ('saffron-routes', 'Saffron Routes')) AS seed(slug, name)
WHERE NOT EXISTS (SELECT 1 FROM tenant existing WHERE existing.slug = seed.slug);

INSERT INTO app_user (
    first_name, last_name, email, password, phone_number, active, created_time, version, tenant_id, simulated
)
SELECT seed.first_name, seed.last_name, seed.email,
       '$2y$10$Nt93cyP1zWSTQC12nvIGkO6OuFhozbuu48Kjv6Z0UMRtATnhYFy0a',
       seed.phone_number, TRUE, TIMESTAMP '2026-10-01 09:00:00', 0, tenant.id, TRUE
FROM (VALUES
    ('Arjun', 'Rao', 'driver1@sim.velobusiness.demo', '+91-9100000001', 'default'),
    ('Meera', 'Iyer', 'driver2@sim.velobusiness.demo', '+91-9100000002', 'default'),
    ('Kabir', 'Shah', 'driver3@sim.velobusiness.demo', '+91-9100000003', 'default'),
    ('Nikhil', 'Menon', 'driver4@sim.velobusiness.demo', '+91-9100000004', 'default'),
    ('Sana', 'Qureshi', 'driver5@sim.velobusiness.demo', '+91-9100000005', 'default'),
    ('Rohit', 'Kulkarni', 'driver6@sim.velobusiness.demo', '+91-9100000006', 'default'),
    ('Priya', 'Nair', 'rider1@sim.velobusiness.demo', '+91-9100000011', 'default'),
    ('Daniel', 'Brooks', 'rider2@sim.velobusiness.demo', '+91-9100000012', 'default'),
    ('Aisha', 'Khan', 'rider3@sim.velobusiness.demo', '+91-9100000013', 'default'),
    ('Tom', 'Becker', 'rider4@sim.velobusiness.demo', '+91-9100000014', 'default'),
    ('Leah', 'Parker', 'rider5@sim.velobusiness.demo', '+91-9100000015', 'default'),
    ('Omar', 'Patel', 'rider6@sim.velobusiness.demo', '+91-9100000016', 'default'),
    ('Maya', 'Chen', 'rider7@sim.velobusiness.demo', '+91-9100000017', 'default'),
    ('Ethan', 'Wright', 'rider8@sim.velobusiness.demo', '+91-9100000018', 'default'),
    ('Sofia', 'Ahmed', 'rider9@sim.velobusiness.demo', '+91-9100000019', 'default'),
    ('Lucas', 'Meyer', 'rider10@sim.velobusiness.demo', '+91-9100000020', 'default'),
    ('Imran', 'Sheikh', 'chauffeur1@sim.saffronroutes.demo', '+91-9200000001', 'saffron-routes'),
    ('Lakshmi', 'Prasad', 'chauffeur2@sim.saffronroutes.demo', '+91-9200000002', 'saffron-routes'),
    ('Vivek', 'Hegde', 'chauffeur3@sim.saffronroutes.demo', '+91-9200000003', 'saffron-routes'),
    ('Farhan', 'Ali', 'chauffeur4@sim.saffronroutes.demo', '+91-9200000004', 'saffron-routes'),
    ('Deepa', 'Rao', 'chauffeur5@sim.saffronroutes.demo', '+91-9200000005', 'saffron-routes'),
    ('Suresh', 'Gowda', 'chauffeur6@sim.saffronroutes.demo', '+91-9200000006', 'saffron-routes'),
    ('Kavya', 'Reddy', 'guest1@sim.saffronroutes.demo', '+91-9200000011', 'saffron-routes'),
    ('Marco', 'Rossi', 'guest2@sim.saffronroutes.demo', '+91-9200000012', 'saffron-routes'),
    ('Neha', 'Gupta', 'guest3@sim.saffronroutes.demo', '+91-9200000013', 'saffron-routes'),
    ('James', 'Wilson', 'guest4@sim.saffronroutes.demo', '+91-9200000014', 'saffron-routes'),
    ('Aanya', 'Rao', 'guest5@sim.saffronroutes.demo', '+91-9200000015', 'saffron-routes'),
    ('David', 'Kim', 'guest6@sim.saffronroutes.demo', '+91-9200000016', 'saffron-routes'),
    ('Zara', 'Khan', 'guest7@sim.saffronroutes.demo', '+91-9200000017', 'saffron-routes'),
    ('Oscar', 'Martin', 'guest8@sim.saffronroutes.demo', '+91-9200000018', 'saffron-routes'),
    ('Pooja', 'Nair', 'guest9@sim.saffronroutes.demo', '+91-9200000019', 'saffron-routes'),
    ('Liam', 'Foster', 'guest10@sim.saffronroutes.demo', '+91-9200000020', 'saffron-routes')
) AS seed(first_name, last_name, email, phone_number, tenant_slug)
JOIN tenant ON tenant.slug = seed.tenant_slug
ON CONFLICT (email) DO UPDATE
SET first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    password = EXCLUDED.password,
    phone_number = EXCLUDED.phone_number,
    active = TRUE,
    tenant_id = EXCLUDED.tenant_id,
    simulated = TRUE;

INSERT INTO user_roles (user_id, roles)
SELECT app_user.id, assigned.role
FROM (VALUES
    ('driver1@sim.velobusiness.demo', 'DRIVER'),
    ('driver2@sim.velobusiness.demo', 'DRIVER'),
    ('driver3@sim.velobusiness.demo', 'DRIVER'),
    ('driver4@sim.velobusiness.demo', 'DRIVER'),
    ('driver5@sim.velobusiness.demo', 'DRIVER'),
    ('driver6@sim.velobusiness.demo', 'DRIVER'),
    ('rider1@sim.velobusiness.demo', 'RIDER'),
    ('rider2@sim.velobusiness.demo', 'RIDER'),
    ('rider3@sim.velobusiness.demo', 'RIDER'),
    ('rider4@sim.velobusiness.demo', 'RIDER'),
    ('rider5@sim.velobusiness.demo', 'RIDER'),
    ('rider6@sim.velobusiness.demo', 'RIDER'),
    ('rider7@sim.velobusiness.demo', 'RIDER'),
    ('rider8@sim.velobusiness.demo', 'RIDER'),
    ('rider9@sim.velobusiness.demo', 'RIDER'),
    ('rider10@sim.velobusiness.demo', 'RIDER'),
    ('chauffeur1@sim.saffronroutes.demo', 'DRIVER'),
    ('chauffeur2@sim.saffronroutes.demo', 'DRIVER'),
    ('chauffeur3@sim.saffronroutes.demo', 'DRIVER'),
    ('chauffeur4@sim.saffronroutes.demo', 'DRIVER'),
    ('chauffeur5@sim.saffronroutes.demo', 'DRIVER'),
    ('chauffeur6@sim.saffronroutes.demo', 'DRIVER'),
    ('guest1@sim.saffronroutes.demo', 'RIDER'),
    ('guest2@sim.saffronroutes.demo', 'RIDER'),
    ('guest3@sim.saffronroutes.demo', 'RIDER'),
    ('guest4@sim.saffronroutes.demo', 'RIDER'),
    ('guest5@sim.saffronroutes.demo', 'RIDER'),
    ('guest6@sim.saffronroutes.demo', 'RIDER'),
    ('guest7@sim.saffronroutes.demo', 'RIDER'),
    ('guest8@sim.saffronroutes.demo', 'RIDER'),
    ('guest9@sim.saffronroutes.demo', 'RIDER'),
    ('guest10@sim.saffronroutes.demo', 'RIDER')
) AS assigned(email, role)
JOIN app_user ON app_user.email = assigned.email
ON CONFLICT (user_id, roles) DO NOTHING;

INSERT INTO rider (user_id, rating, version, tenant_id)
SELECT app_user.id, seed.rating, 0, tenant.id
FROM (VALUES
    ('rider1@sim.velobusiness.demo', 4.9::DOUBLE PRECISION, 'default'),
    ('rider2@sim.velobusiness.demo', 4.8::DOUBLE PRECISION, 'default'),
    ('rider3@sim.velobusiness.demo', 4.7::DOUBLE PRECISION, 'default'),
    ('rider4@sim.velobusiness.demo', 4.6::DOUBLE PRECISION, 'default'),
    ('rider5@sim.velobusiness.demo', 4.9::DOUBLE PRECISION, 'default'),
    ('rider6@sim.velobusiness.demo', 4.8::DOUBLE PRECISION, 'default'),
    ('rider7@sim.velobusiness.demo', 4.7::DOUBLE PRECISION, 'default'),
    ('rider8@sim.velobusiness.demo', 4.6::DOUBLE PRECISION, 'default'),
    ('rider9@sim.velobusiness.demo', 4.9::DOUBLE PRECISION, 'default'),
    ('rider10@sim.velobusiness.demo', 4.8::DOUBLE PRECISION, 'default'),
    ('guest1@sim.saffronroutes.demo', 4.9::DOUBLE PRECISION, 'saffron-routes'),
    ('guest2@sim.saffronroutes.demo', 4.8::DOUBLE PRECISION, 'saffron-routes'),
    ('guest3@sim.saffronroutes.demo', 4.7::DOUBLE PRECISION, 'saffron-routes'),
    ('guest4@sim.saffronroutes.demo', 4.6::DOUBLE PRECISION, 'saffron-routes'),
    ('guest5@sim.saffronroutes.demo', 4.9::DOUBLE PRECISION, 'saffron-routes'),
    ('guest6@sim.saffronroutes.demo', 4.8::DOUBLE PRECISION, 'saffron-routes'),
    ('guest7@sim.saffronroutes.demo', 4.7::DOUBLE PRECISION, 'saffron-routes'),
    ('guest8@sim.saffronroutes.demo', 4.6::DOUBLE PRECISION, 'saffron-routes'),
    ('guest9@sim.saffronroutes.demo', 4.9::DOUBLE PRECISION, 'saffron-routes'),
    ('guest10@sim.saffronroutes.demo', 4.8::DOUBLE PRECISION, 'saffron-routes')
) AS seed(email, rating, tenant_slug)
JOIN app_user ON app_user.email = seed.email
JOIN tenant ON tenant.slug = seed.tenant_slug
ON CONFLICT (user_id) DO UPDATE
SET rating = EXCLUDED.rating,
    tenant_id = EXCLUDED.tenant_id;

-- Simulated drivers rest offline: the launcher's fixture refresher clears their location and the
-- simulator places them again when it starts.
INSERT INTO driver (
    user_id, vehicle_id, rating, available, onboarding_status, current_location, created_at, version, tenant_id
)
SELECT app_user.id, seed.vehicle_id, seed.rating, FALSE, 'APPROVED', NULL,
       TIMESTAMP '2026-10-01 09:30:00', 0, tenant.id
FROM (VALUES
    ('driver1@sim.velobusiness.demo', 'KA01SV1001', 4.90::DOUBLE PRECISION, 'default'),
    ('driver2@sim.velobusiness.demo', 'KA01SV1002', 4.80::DOUBLE PRECISION, 'default'),
    ('driver3@sim.velobusiness.demo', 'KA01SV1003', 4.75::DOUBLE PRECISION, 'default'),
    ('driver4@sim.velobusiness.demo', 'KA01SV1004', 4.85::DOUBLE PRECISION, 'default'),
    ('driver5@sim.velobusiness.demo', 'KA01SV1005', 4.60::DOUBLE PRECISION, 'default'),
    ('driver6@sim.velobusiness.demo', 'KA01SV1006', 4.95::DOUBLE PRECISION, 'default'),
    ('chauffeur1@sim.saffronroutes.demo', 'KA03SS2001', 4.90::DOUBLE PRECISION, 'saffron-routes'),
    ('chauffeur2@sim.saffronroutes.demo', 'KA03SS2002', 4.75::DOUBLE PRECISION, 'saffron-routes'),
    ('chauffeur3@sim.saffronroutes.demo', 'KA03SS2003', 4.85::DOUBLE PRECISION, 'saffron-routes'),
    ('chauffeur4@sim.saffronroutes.demo', 'KA03SS2004', 4.60::DOUBLE PRECISION, 'saffron-routes'),
    ('chauffeur5@sim.saffronroutes.demo', 'KA03SS2005', 4.95::DOUBLE PRECISION, 'saffron-routes'),
    ('chauffeur6@sim.saffronroutes.demo', 'KA03SS2006', 4.70::DOUBLE PRECISION, 'saffron-routes')
) AS seed(email, vehicle_id, rating, tenant_slug)
JOIN app_user ON app_user.email = seed.email
JOIN tenant ON tenant.slug = seed.tenant_slug
ON CONFLICT (user_id) DO UPDATE
SET vehicle_id = EXCLUDED.vehicle_id,
    rating = EXCLUDED.rating,
    available = FALSE,
    onboarding_status = EXCLUDED.onboarding_status,
    current_location = NULL,
    tenant_id = EXCLUDED.tenant_id;

INSERT INTO wallet (user_id, balance, version, tenant_id)
SELECT app_user.id, seed.balance, 0, tenant.id
FROM (VALUES
    ('driver1@sim.velobusiness.demo', 0.00::NUMERIC, 'default'),
    ('driver2@sim.velobusiness.demo', 0.00::NUMERIC, 'default'),
    ('driver3@sim.velobusiness.demo', 0.00::NUMERIC, 'default'),
    ('driver4@sim.velobusiness.demo', 0.00::NUMERIC, 'default'),
    ('driver5@sim.velobusiness.demo', 0.00::NUMERIC, 'default'),
    ('driver6@sim.velobusiness.demo', 0.00::NUMERIC, 'default'),
    ('rider1@sim.velobusiness.demo', 5000.00::NUMERIC, 'default'),
    ('rider2@sim.velobusiness.demo', 5000.00::NUMERIC, 'default'),
    ('rider3@sim.velobusiness.demo', 5000.00::NUMERIC, 'default'),
    ('rider4@sim.velobusiness.demo', 5000.00::NUMERIC, 'default'),
    ('rider5@sim.velobusiness.demo', 5000.00::NUMERIC, 'default'),
    ('rider6@sim.velobusiness.demo', 5000.00::NUMERIC, 'default'),
    ('rider7@sim.velobusiness.demo', 5000.00::NUMERIC, 'default'),
    ('rider8@sim.velobusiness.demo', 5000.00::NUMERIC, 'default'),
    ('rider9@sim.velobusiness.demo', 5000.00::NUMERIC, 'default'),
    ('rider10@sim.velobusiness.demo', 5000.00::NUMERIC, 'default'),
    ('chauffeur1@sim.saffronroutes.demo', 0.00::NUMERIC, 'saffron-routes'),
    ('chauffeur2@sim.saffronroutes.demo', 0.00::NUMERIC, 'saffron-routes'),
    ('chauffeur3@sim.saffronroutes.demo', 0.00::NUMERIC, 'saffron-routes'),
    ('chauffeur4@sim.saffronroutes.demo', 0.00::NUMERIC, 'saffron-routes'),
    ('chauffeur5@sim.saffronroutes.demo', 0.00::NUMERIC, 'saffron-routes'),
    ('chauffeur6@sim.saffronroutes.demo', 0.00::NUMERIC, 'saffron-routes'),
    ('guest1@sim.saffronroutes.demo', 500000.00::NUMERIC, 'saffron-routes'),
    ('guest2@sim.saffronroutes.demo', 500000.00::NUMERIC, 'saffron-routes'),
    ('guest3@sim.saffronroutes.demo', 500000.00::NUMERIC, 'saffron-routes'),
    ('guest4@sim.saffronroutes.demo', 500000.00::NUMERIC, 'saffron-routes'),
    ('guest5@sim.saffronroutes.demo', 500000.00::NUMERIC, 'saffron-routes'),
    ('guest6@sim.saffronroutes.demo', 500000.00::NUMERIC, 'saffron-routes'),
    ('guest7@sim.saffronroutes.demo', 500000.00::NUMERIC, 'saffron-routes'),
    ('guest8@sim.saffronroutes.demo', 500000.00::NUMERIC, 'saffron-routes'),
    ('guest9@sim.saffronroutes.demo', 500000.00::NUMERIC, 'saffron-routes'),
    ('guest10@sim.saffronroutes.demo', 500000.00::NUMERIC, 'saffron-routes')
) AS seed(email, balance, tenant_slug)
JOIN app_user ON app_user.email = seed.email
JOIN tenant ON tenant.slug = seed.tenant_slug
ON CONFLICT (user_id) DO UPDATE
SET balance = EXCLUDED.balance,
    tenant_id = EXCLUDED.tenant_id;
