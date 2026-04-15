CREATE TABLE IF NOT EXISTS tenant (
    id BIGSERIAL PRIMARY KEY,
    slug VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_configuration (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL UNIQUE,
    brand_name VARCHAR(255) NOT NULL DEFAULT 'Velo',
    primary_color VARCHAR(16) NOT NULL DEFAULT '#2563EB',
    logo_url VARCHAR(1024),
    rider_label VARCHAR(64) NOT NULL DEFAULT 'Rider',
    driver_label VARCHAR(64) NOT NULL DEFAULT 'Driver',
    trip_label VARCHAR(64) NOT NULL DEFAULT 'Trip',
    dispatch_mode VARCHAR(32) NOT NULL DEFAULT 'RIDE_HAILING',
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_tenant_configuration_tenant FOREIGN KEY (tenant_id) REFERENCES tenant (id),
    CONSTRAINT chk_tenant_dispatch_mode CHECK (
        dispatch_mode IN ('RIDE_HAILING', 'DELIVERY_MERCHANT', 'FLEET_MANAGED')
    )
);

INSERT INTO tenant (id, slug, name, active, created_at)
VALUES (1, 'default', 'Default Tenant', TRUE, NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO tenant_configuration (
    tenant_id,
    brand_name,
    primary_color,
    logo_url,
    rider_label,
    driver_label,
    trip_label,
    dispatch_mode,
    updated_at
)
SELECT
    1,
    'Velo',
    '#2563EB',
    NULL,
    'Rider',
    'Driver',
    'Trip',
    'RIDE_HAILING',
    NOW()
WHERE NOT EXISTS (
    SELECT 1
    FROM tenant_configuration
    WHERE tenant_id = 1
);

ALTER TABLE app_user ADD COLUMN IF NOT EXISTS tenant_id BIGINT;
UPDATE app_user SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE app_user ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_app_user_tenant ON app_user (tenant_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_app_user_tenant'
    ) THEN
        ALTER TABLE app_user
            ADD CONSTRAINT fk_app_user_tenant
                FOREIGN KEY (tenant_id) REFERENCES tenant (id);
    END IF;
END
$$;

ALTER TABLE rider ADD COLUMN IF NOT EXISTS tenant_id BIGINT;
UPDATE rider r
SET tenant_id = u.tenant_id
FROM app_user u
WHERE r.user_id = u.id
  AND r.tenant_id IS NULL;
UPDATE rider SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE rider ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rider_tenant ON rider (tenant_id);

ALTER TABLE driver ADD COLUMN IF NOT EXISTS tenant_id BIGINT;
UPDATE driver d
SET tenant_id = u.tenant_id
FROM app_user u
WHERE d.user_id = u.id
  AND d.tenant_id IS NULL;
UPDATE driver SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE driver ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_driver_tenant ON driver (tenant_id);

ALTER TABLE ride_request ADD COLUMN IF NOT EXISTS tenant_id BIGINT;
UPDATE ride_request rr
SET tenant_id = r.tenant_id
FROM rider r
WHERE rr.rider_id = r.id
  AND rr.tenant_id IS NULL;
UPDATE ride_request SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE ride_request ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ride_request_tenant ON ride_request (tenant_id);

ALTER TABLE ride ADD COLUMN IF NOT EXISTS tenant_id BIGINT;
UPDATE ride rd
SET tenant_id = r.tenant_id
FROM rider r
WHERE rd.rider_id = r.id
  AND rd.tenant_id IS NULL;
UPDATE ride rd
SET tenant_id = d.tenant_id
FROM driver d
WHERE rd.driver_id = d.id
  AND rd.tenant_id IS NULL;
UPDATE ride SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE ride ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ride_tenant ON ride (tenant_id);

ALTER TABLE wallet ADD COLUMN IF NOT EXISTS tenant_id BIGINT;
UPDATE wallet w
SET tenant_id = u.tenant_id
FROM app_user u
WHERE w.user_id = u.id
  AND w.tenant_id IS NULL;
UPDATE wallet SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE wallet ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wallet_tenant ON wallet (tenant_id);

ALTER TABLE ride_offer ADD COLUMN IF NOT EXISTS tenant_id BIGINT;
UPDATE ride_offer ro
SET tenant_id = rr.tenant_id
FROM ride_request rr
WHERE ro.ride_request_id = rr.id
  AND ro.tenant_id IS NULL;
UPDATE ride_offer SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE ride_offer ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ride_offer_tenant ON ride_offer (tenant_id);

ALTER TABLE payment ADD COLUMN IF NOT EXISTS tenant_id BIGINT;
UPDATE payment p
SET tenant_id = u.tenant_id
FROM app_user u
WHERE p.user_id = u.id
  AND p.tenant_id IS NULL;
UPDATE payment p
SET tenant_id = r.tenant_id
FROM ride r
WHERE p.ride_id = r.id
  AND p.tenant_id IS NULL;
UPDATE payment SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE payment ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_tenant ON payment (tenant_id);

ALTER TABLE promo_code_usage ADD COLUMN IF NOT EXISTS tenant_id BIGINT;
UPDATE promo_code_usage pcu
SET tenant_id = u.tenant_id
FROM app_user u
WHERE pcu.user_id = u.id
  AND pcu.tenant_id IS NULL;
UPDATE promo_code_usage SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE promo_code_usage ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_promo_usage_tenant ON promo_code_usage (tenant_id);

ALTER TABLE notification ADD COLUMN IF NOT EXISTS tenant_id BIGINT;
UPDATE notification n
SET tenant_id = u.tenant_id
FROM app_user u
WHERE n.user_id = u.id
  AND n.tenant_id IS NULL;
UPDATE notification SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE notification ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notification_tenant ON notification (tenant_id);

ALTER TABLE driver_earning ADD COLUMN IF NOT EXISTS tenant_id BIGINT;
UPDATE driver_earning de
SET tenant_id = d.tenant_id
FROM driver d
WHERE de.driver_id = d.id
  AND de.tenant_id IS NULL;
UPDATE driver_earning SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE driver_earning ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_driver_earning_tenant ON driver_earning (tenant_id);

ALTER TABLE payout_request ADD COLUMN IF NOT EXISTS tenant_id BIGINT;
UPDATE payout_request pr
SET tenant_id = d.tenant_id
FROM driver d
WHERE pr.driver_id = d.id
  AND pr.tenant_id IS NULL;
UPDATE payout_request SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE payout_request ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payout_request_tenant ON payout_request (tenant_id);

ALTER TABLE payment_method ADD COLUMN IF NOT EXISTS tenant_id BIGINT;
UPDATE payment_method pm
SET tenant_id = u.tenant_id
FROM app_user u
WHERE pm.user_id = u.id
  AND pm.tenant_id IS NULL;
UPDATE payment_method SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE payment_method ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_method_tenant ON payment_method (tenant_id);

ALTER TABLE wallet_transaction ADD COLUMN IF NOT EXISTS tenant_id BIGINT;
UPDATE wallet_transaction wt
SET tenant_id = w.tenant_id
FROM wallet w
WHERE wt.wallet_id = w.id
  AND wt.tenant_id IS NULL;
UPDATE wallet_transaction wt
SET tenant_id = r.tenant_id
FROM ride r
WHERE wt.ride_id = r.id
  AND wt.tenant_id IS NULL;
UPDATE wallet_transaction SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE wallet_transaction ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wallet_transaction_tenant ON wallet_transaction (tenant_id);

ALTER TABLE app_user ALTER COLUMN tenant_id SET DEFAULT 1;
ALTER TABLE rider ALTER COLUMN tenant_id SET DEFAULT 1;
ALTER TABLE driver ALTER COLUMN tenant_id SET DEFAULT 1;
ALTER TABLE ride_request ALTER COLUMN tenant_id SET DEFAULT 1;
ALTER TABLE ride ALTER COLUMN tenant_id SET DEFAULT 1;
ALTER TABLE wallet ALTER COLUMN tenant_id SET DEFAULT 1;
ALTER TABLE ride_offer ALTER COLUMN tenant_id SET DEFAULT 1;
ALTER TABLE payment ALTER COLUMN tenant_id SET DEFAULT 1;
ALTER TABLE promo_code_usage ALTER COLUMN tenant_id SET DEFAULT 1;
ALTER TABLE notification ALTER COLUMN tenant_id SET DEFAULT 1;
ALTER TABLE driver_earning ALTER COLUMN tenant_id SET DEFAULT 1;
ALTER TABLE payout_request ALTER COLUMN tenant_id SET DEFAULT 1;
ALTER TABLE payment_method ALTER COLUMN tenant_id SET DEFAULT 1;
ALTER TABLE wallet_transaction ALTER COLUMN tenant_id SET DEFAULT 1;

DO $$
DECLARE
    max_tenant_id BIGINT;
BEGIN
    SELECT MAX(id) INTO max_tenant_id FROM tenant;
    IF max_tenant_id IS NULL THEN
        max_tenant_id := 1;
    END IF;
    PERFORM setval(pg_get_serial_sequence('tenant', 'id'), max_tenant_id);
END
$$;
